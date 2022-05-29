import * as path from 'path'
import * as fs from 'fs'
import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

const config = new pulumi.Config()

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

// Load cloud-init config
const cloudConfig = fs.readFileSync(path.join(__dirname, 'cloud-config.yaml'), { encoding: 'utf-8' })
  .replace('<DISCORD_CLIENT_ID>', config.require('discordClientId'))
  .replace('<DISCORD_TOKEN>', config.require('discordToken'))

// Create instance for running the bot
const instance = new aws.ec2.Instance('beet-bot', {
  instanceType: 't2.micro', // Available in the AWS free tier
  ami: 'ami-0022f774911c1d690', // Latest amazon linux AMI
  vpcSecurityGroupIds: [group.id],
  userData: cloudConfig,
  userDataReplaceOnChange: true
})

export const instanceId = instance.id
export const publicIp = instance.publicIp
export const publicHostName = instance.publicDns
