import * as path from 'path'
import * as fs from 'fs/promises'
import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'
import * as ipNum from 'ip-num'

const awsConfig = new pulumi.Config('aws')
const config = new pulumi.Config()

const region = awsConfig.require('region')
const availabilityZone = region + 'b'

// Provide credentials via SSM parameters
const clientId = new aws.ssm.Parameter('beet-bot-client-id', {
  type: 'String',
  name: `/beet-bot/${pulumi.getStack()}/client-id`,
  value: config.require('client-id')
})

const token = new aws.ssm.Parameter('beet-bot-token', {
  type: 'SecureString',
  name: `/beet-bot/${pulumi.getStack()}/token`,
  value: config.require('token')
})

// Persist state using DynamoDB
const table = new aws.dynamodb.Table('beet-bot-table', {
  readCapacity: 20,
  writeCapacity: 20,
  hashKey: 'Id',
  attributes: [
    { name: 'Id', type: 'S' }
  ]
})

// Networking
const vpc = new aws.ec2.Vpc('beet-bot-vpc', {
  enableDnsHostnames: true,
  enableDnsSupport: true,
  assignGeneratedIpv6CidrBlock: true,
  cidrBlock: '10.0.0.0/16'
})

const subnetRanges = vpc.ipv6CidrBlock.apply((ipv6CidrBlock) => {
  const [ip, prefix] = ipv6CidrBlock.split('/')
  const block = new ipNum.IPv6CidrRange(new ipNum.IPv6(ip), new ipNum.IPv6Prefix(BigInt(prefix)))
  return block.splitInto(new ipNum.IPv6Prefix(BigInt(64)))
})

const subnet = new aws.ec2.Subnet('beet-bot-subnet', {
  vpcId: vpc.id,
  availabilityZone,
  enableDns64: true,
  cidrBlock: '10.0.0.0/24',
  ipv6CidrBlock: subnetRanges.apply(ranges => ranges[1].toCidrString()),
  assignIpv6AddressOnCreation: true
})

const igw = new aws.ec2.InternetGateway('beet-bot-igw', { vpcId: vpc.id })
const rtb = new aws.ec2.RouteTable('beet-bot-rtb', {
  vpcId: vpc.id,
  routes: [
    {
      cidrBlock: '0.0.0.0/0',
      gatewayId: igw.id
    },
    {
      ipv6CidrBlock: '::/0',
      gatewayId: igw.id
    }
  ]
})

const rtbAssoc = new aws.ec2.RouteTableAssociation('beet-bot-rtb-assoc', {
  routeTableId: rtb.id,
  subnetId: subnet.id
})

// Security group
const sg = new aws.ec2.SecurityGroup('beet-bot-sg', {
  vpcId: vpc.id,
  ingress: [
    { protocol: 'tcp', fromPort: 22, toPort: 22, cidrBlocks: ['0.0.0.0/0'] },
    { protocol: 'tcp', fromPort: 22, toPort: 22, ipv6CidrBlocks: ['::/0'] }
  ],
  egress: [
    { protocol: 'tcp', fromPort: 80, toPort: 80, cidrBlocks: ['0.0.0.0/0'] },
    { protocol: 'tcp', fromPort: 80, toPort: 80, ipv6CidrBlocks: ['::/0'] },
    { protocol: 'tcp', fromPort: 443, toPort: 443, cidrBlocks: ['0.0.0.0/0'] },
    { protocol: 'tcp', fromPort: 443, toPort: 443, ipv6CidrBlocks: ['::/0'] }
  ]
})

// Setup instance role
const policy = new aws.iam.RolePolicy('beet-bot-policy', {
  role: new aws.iam.Role('beet-bot-role', {
    assumeRolePolicy: {
      Version: '2012-10-17',
      Statement: [{
        Action: 'sts:AssumeRole',
        Effect: 'Allow',
        Principal: {
          Service: 'ec2.amazonaws.com'
        }
      }]
    }
  }),
  policy: {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'ssm:GetParameter',
        Effect: 'Allow',
        Resource: [clientId.arn, token.arn]
      },
      {
        Action: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:DeleteItem'
        ],
        Effect: 'Allow',
        Resource: [table.arn]
      }
    ]
  }
})

// Load cloud-init config
const cloudConfig = pulumi.all({
  cloudConfig: fs.readFile(path.join(__dirname, 'cloud-config.yaml'), { encoding: 'utf-8' }),
  tableName: table.name,
  clientId: clientId.name,
  token: token.name
})
  .apply(({ cloudConfig, tableName, clientId, token }) =>
    cloudConfig
      .replaceAll('<AWS_REGION>', region)
      .replaceAll('<DYNAMODB_TABLE>', tableName)
      .replaceAll('<DISCORD_CLIENT_ID>', `ssm:${clientId}`)
      .replaceAll('<DISCORD_TOKEN>', `ssm:${token}`)
  )

// Create instance for running the bot
const instance = new aws.ec2.Instance('beet-bot', {
  instanceType: 't3.micro', // Available in the AWS free tier
  ami: 'ami-01eccbf80522b562b', // Amazon Linux 2 AMI
  availabilityZone,
  subnetId: subnet.id,
  ipv6AddressCount: 1,
  vpcSecurityGroupIds: [sg.id],
  iamInstanceProfile: new aws.iam.InstanceProfile('beet-bot-profile', { role: policy.role }),
  userData: cloudConfig,
  userDataReplaceOnChange: true
}, { dependsOn: rtbAssoc })

// EC2 Instance connect endpoint
const iceSg = new aws.ec2.SecurityGroup('beet-bot-ice-sg', {
  vpcId: vpc.id,
  egress: [
    { protocol: 'tcp', fromPort: 22, toPort: 22, cidrBlocks: ['0.0.0.0/0'] },
    { protocol: 'tcp', fromPort: 22, toPort: 22, ipv6CidrBlocks: ['::/0'] }
  ]
})

const ice = new aws.ec2transitgateway.InstanceConnectEndpoint('beet-bot-ice', {
  subnetId: subnet.id,
  securityGroupIds: [iceSg.id]
})

export const vpcIpv6CidrBlock = vpc.ipv6CidrBlock
export const subnetIpv6CidrBlock = subnet.ipv6CidrBlock
export const instanceId = instance.id
export const iceId = ice.id
