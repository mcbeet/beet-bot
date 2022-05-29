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
    Statement: [{
      Action: 'ssm:GetParameter',
      Effect: 'Allow',
      Resource: [clientId.arn, token.arn]
    }]
  }
})

// Load cloud-init config
const cloudConfig = pulumi.all({
  cloudConfig: fs.readFile(path.join(__dirname, 'cloud-config.yaml'), { encoding: 'utf-8' }),
  clientId: clientId.name,
  token: token.name
})
  .apply(({ cloudConfig, clientId, token }) =>
    cloudConfig
      .replace('<AWS_REGION>', awsConfig.require('region'))
      .replace('<DISCORD_CLIENT_ID>', `ssm:${clientId}`)
      .replace('<DISCORD_TOKEN>', `ssm:${token}`)
  )

// Create instance for running the bot
const instance = new aws.ec2.Instance('beet-bot', {
  instanceType: 't2.micro', // Available in the AWS free tier
  ami: 'ami-0022f774911c1d690', // Latest amazon linux AMI
  vpcSecurityGroupIds: [group.id],
  iamInstanceProfile: new aws.iam.InstanceProfile('beet-bot-profile', { role: policy.role }),
  userData: cloudConfig,
  userDataReplaceOnChange: true
})

export const instanceId = instance.id
export const publicIp = instance.publicIp
export const publicHostName = instance.publicDns
