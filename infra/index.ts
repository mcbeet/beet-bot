import * as path from 'path'
import * as fs from 'fs/promises'
import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

const awsConfig = new pulumi.Config('aws')
const config = new pulumi.Config()

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
const vpc = new aws.ec2.Vpc('beet-bot-vpc', { cidrBlock: '10.0.0.0/16' })
const subnet = new aws.ec2.Subnet('beet-bot-subnet', {
  vpcId: vpc.id,
  cidrBlock: '10.0.0.0/24'
})

const igw = new aws.ec2.InternetGateway('beet-bot-igw', { vpcId: vpc.id })
const rt = new aws.ec2.RouteTable('beet-bot-rt', {
  vpcId: vpc.id,
  routes: [
    {
      cidrBlock: '0.0.0.0/0',
      gatewayId: igw.id
    }
  ]
})

const rta = new aws.ec2.RouteTableAssociation('beet-bot-rta', {
  routeTableId: rt.id,
  subnetId: subnet.id
})

// Allow SSH and HTTP
const group = new aws.ec2.SecurityGroup('beet-bot-security', {
  ingress: [
    { protocol: 'tcp', fromPort: 22, toPort: 22, cidrBlocks: ['0.0.0.0/0'] }
  ],
  egress: [
    { protocol: 'tcp', fromPort: 80, toPort: 80, cidrBlocks: ['0.0.0.0/0'] },
    { protocol: 'tcp', fromPort: 443, toPort: 443, cidrBlocks: ['0.0.0.0/0'] }
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
      .replaceAll('<AWS_REGION>', awsConfig.require('region'))
      .replaceAll('<DYNAMODB_TABLE>', tableName)
      .replaceAll('<DISCORD_CLIENT_ID>', `ssm:${clientId}`)
      .replaceAll('<DISCORD_TOKEN>', `ssm:${token}`)
  )

// Create instance for running the bot
const instance = new aws.ec2.Instance('beet-bot', {
  instanceType: 't2.micro', // Available in the AWS free tier
  ami: 'ami-0022f774911c1d690', // Latest amazon linux AMI
  subnetId: subnet.id,
  vpcSecurityGroupIds: [group.id],
  iamInstanceProfile: new aws.iam.InstanceProfile('beet-bot-profile', { role: policy.role }),
  userData: cloudConfig,
  userDataReplaceOnChange: true
})

export const instanceId = instance.id
export const rtaId = rta.id
