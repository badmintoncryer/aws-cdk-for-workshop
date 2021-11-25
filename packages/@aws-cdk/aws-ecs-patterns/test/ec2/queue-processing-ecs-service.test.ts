import { ABSENT } from '@aws-cdk/assert-internal';
import '@aws-cdk/assert-internal/jest';
import { AutoScalingGroup } from '@aws-cdk/aws-autoscaling';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import { MachineImage } from '@aws-cdk/aws-ec2';
import * as ec2 from '@aws-cdk/aws-ec2';
import { AsgCapacityProvider } from '@aws-cdk/aws-ecs';
import * as ecs from '@aws-cdk/aws-ecs';
import * as sqs from '@aws-cdk/aws-sqs';
import { testDeprecated } from '@aws-cdk/cdk-build-tools';
import * as cdk from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import * as ecsPatterns from '../../lib';

test('test ECS queue worker service construct - with only required props', () => {
  // GIVEN
  const stack = new cdk.Stack();
  const vpc = new ec2.Vpc(stack, 'VPC');
  const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
  cluster.addAsgCapacityProvider(new AsgCapacityProvider(stack, 'DefaultAutoScalingGroupProvider', {
    autoScalingGroup: new AutoScalingGroup(stack, 'DefaultAutoScalingGroup', {
      vpc,
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: MachineImage.latestAmazonLinux(),
    }),
  }));

  // WHEN
  new ecsPatterns.QueueProcessingEc2Service(stack, 'Service', {
    cluster,
    memoryLimitMiB: 512,
    image: ecs.ContainerImage.fromRegistry('test'),
  });

  // THEN - QueueWorker is of EC2 launch type, an SQS queue is created and all default properties are set.
  expect(stack).toHaveResource('AWS::ECS::Service', {
    DesiredCount: 1,
    LaunchType: 'EC2',
  });

  expect(stack).toHaveResource('AWS::SQS::Queue', {
    RedrivePolicy: {
      deadLetterTargetArn: {
        'Fn::GetAtt': [
          'ServiceEcsProcessingDeadLetterQueue4A89196E',
          'Arn',
        ],
      },
      maxReceiveCount: 3,
    },
  });

  expect(stack).toHaveResource('AWS::SQS::Queue', {
    MessageRetentionPeriod: 1209600,
  });

  expect(stack).toHaveResourceLike('AWS::ECS::TaskDefinition', {
    ContainerDefinitions: [
      {
        Environment: [
          {
            Name: 'QUEUE_NAME',
            Value: {
              'Fn::GetAtt': [
                'ServiceEcsProcessingQueueC266885C',
                'QueueName',
              ],
            },
          },
        ],
        LogConfiguration: {
          LogDriver: 'awslogs',
          Options: {
            'awslogs-group': {
              Ref: 'ServiceQueueProcessingTaskDefQueueProcessingContainerLogGroupD52338D1',
            },
            'awslogs-stream-prefix': 'Service',
            'awslogs-region': {
              Ref: 'AWS::Region',
            },
          },
        },
        Essential: true,
        Image: 'test',
        Memory: 512,
      },
    ],
    Family: 'ServiceQueueProcessingTaskDef83DB34F1',
  });
});

test('test ECS queue worker service construct - with remove default desiredCount feature flag', () => {
  // GIVEN
  const stack = new cdk.Stack();
  stack.node.setContext(cxapi.ECS_REMOVE_DEFAULT_DESIRED_COUNT, true);

  const vpc = new ec2.Vpc(stack, 'VPC');
  const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
  cluster.addAsgCapacityProvider(new AsgCapacityProvider(stack, 'DefaultAutoScalingGroupProvider', {
    autoScalingGroup: new AutoScalingGroup(stack, 'DefaultAutoScalingGroup', {
      vpc,
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: MachineImage.latestAmazonLinux(),
    }),
  }));

  // WHEN
  new ecsPatterns.QueueProcessingEc2Service(stack, 'Service', {
    cluster,
    memoryLimitMiB: 512,
    image: ecs.ContainerImage.fromRegistry('test'),
  });

  // THEN - QueueWorker is of EC2 launch type, and desiredCount is not defined on the Ec2Service.
  expect(stack).toHaveResource('AWS::ECS::Service', {
    DesiredCount: ABSENT,
    LaunchType: 'EC2',
  });
});

test('test ECS queue worker service construct - with optional props for queues', () => {
  // GIVEN
  const stack = new cdk.Stack();
  const vpc = new ec2.Vpc(stack, 'VPC');
  const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
  cluster.addAsgCapacityProvider(new AsgCapacityProvider(stack, 'DefaultAutoScalingGroupProvider', {
    autoScalingGroup: new AutoScalingGroup(stack, 'DefaultAutoScalingGroup', {
      vpc,
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: MachineImage.latestAmazonLinux(),
    }),
  }));

  // WHEN
  new ecsPatterns.QueueProcessingEc2Service(stack, 'Service', {
    cluster,
    memoryLimitMiB: 512,
    image: ecs.ContainerImage.fromRegistry('test'),
    maxReceiveCount: 42,
    retentionPeriod: cdk.Duration.days(7),
    visibilityTimeout: cdk.Duration.minutes(5),
  });

  // THEN - QueueWorker is of EC2 launch type, an SQS queue is created and all default properties are set.
  expect(stack).toHaveResource('AWS::ECS::Service', {
    DesiredCount: 1,
    LaunchType: 'EC2',
  });

  expect(stack).toHaveResource('AWS::SQS::Queue', {
    RedrivePolicy: {
      deadLetterTargetArn: {
        'Fn::GetAtt': [
          'ServiceEcsProcessingDeadLetterQueue4A89196E',
          'Arn',
        ],
      },
      maxReceiveCount: 42,
    },
    VisibilityTimeout: 300,
  });

  expect(stack).toHaveResource('AWS::SQS::Queue', {
    MessageRetentionPeriod: 604800,
  });

  expect(stack).toHaveResourceLike('AWS::ECS::TaskDefinition', {
    ContainerDefinitions: [
      {
        Environment: [
          {
            Name: 'QUEUE_NAME',
            Value: {
              'Fn::GetAtt': [
                'ServiceEcsProcessingQueueC266885C',
                'QueueName',
              ],
            },
          },
        ],
        LogConfiguration: {
          LogDriver: 'awslogs',
          Options: {
            'awslogs-group': {
              Ref: 'ServiceQueueProcessingTaskDefQueueProcessingContainerLogGroupD52338D1',
            },
            'awslogs-stream-prefix': 'Service',
            'awslogs-region': {
              Ref: 'AWS::Region',
            },
          },
        },
        Essential: true,
        Image: 'test',
        Memory: 512,
      },
    ],
    Family: 'ServiceQueueProcessingTaskDef83DB34F1',
  });
});

testDeprecated('test ECS queue worker service construct - with optional props', () => {
  // GIVEN
  const stack = new cdk.Stack();
  const vpc = new ec2.Vpc(stack, 'VPC');
  const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
  cluster.addAsgCapacityProvider(new AsgCapacityProvider(stack, 'DefaultAutoScalingGroupProvider', {
    autoScalingGroup: new AutoScalingGroup(stack, 'DefaultAutoScalingGroup', {
      vpc,
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: MachineImage.latestAmazonLinux(),
    }),
  }));
  const queue = new sqs.Queue(stack, 'ecs-test-queue', {
    queueName: 'ecs-test-sqs-queue',
  });

  // WHEN
  new ecsPatterns.QueueProcessingEc2Service(stack, 'Service', {
    cluster,
    memoryLimitMiB: 1024,
    image: ecs.ContainerImage.fromRegistry('test'),
    command: ['-c', '4', 'amazon.com'],
    enableLogging: false,
    desiredTaskCount: 2,
    environment: {
      TEST_ENVIRONMENT_VARIABLE1: 'test environment variable 1 value',
      TEST_ENVIRONMENT_VARIABLE2: 'test environment variable 2 value',
    },
    queue,
    maxScalingCapacity: 5,
    minHealthyPercent: 60,
    maxHealthyPercent: 150,
    serviceName: 'ecs-test-service',
    family: 'ecs-task-family',
    circuitBreaker: { rollback: true },
    gpuCount: 256,
  });

  // THEN - QueueWorker is of EC2 launch type, an SQS queue is created and all optional properties are set.
  expect(stack).toHaveResource('AWS::ECS::Service', {
    DesiredCount: 2,
    DeploymentConfiguration: {
      MinimumHealthyPercent: 60,
      MaximumPercent: 150,
      DeploymentCircuitBreaker: {
        Enable: true,
        Rollback: true,
      },
    },
    LaunchType: 'EC2',
    ServiceName: 'ecs-test-service',
    DeploymentController: {
      Type: 'ECS',
    },
  });

  expect(stack).toHaveResource('AWS::SQS::Queue', {
    QueueName: 'ecs-test-sqs-queue',
  });

  expect(stack).toHaveResourceLike('AWS::ECS::TaskDefinition', {
    ContainerDefinitions: [
      {
        Command: [
          '-c',
          '4',
          'amazon.com',
        ],
        Environment: [
          {
            Name: 'TEST_ENVIRONMENT_VARIABLE1',
            Value: 'test environment variable 1 value',
          },
          {
            Name: 'TEST_ENVIRONMENT_VARIABLE2',
            Value: 'test environment variable 2 value',
          },
          {
            Name: 'QUEUE_NAME',
            Value: {
              'Fn::GetAtt': [
                'ecstestqueueD1FDA34B',
                'QueueName',
              ],
            },
          },
        ],
        Image: 'test',
        Memory: 1024,
        ResourceRequirements: [
          {
            Type: 'GPU',
            Value: '256',
          },
        ],
      },
    ],
    Family: 'ecs-task-family',
  });
});

testDeprecated('can set desiredTaskCount to 0', () => {
  // GIVEN
  const stack = new cdk.Stack();
  const vpc = new ec2.Vpc(stack, 'VPC');
  const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
  cluster.addAsgCapacityProvider(new AsgCapacityProvider(stack, 'DefaultAutoScalingGroupProvider', {
    autoScalingGroup: new AutoScalingGroup(stack, 'DefaultAutoScalingGroup', {
      vpc,
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: MachineImage.latestAmazonLinux(),
    }),
  }));

  // WHEN
  new ecsPatterns.QueueProcessingEc2Service(stack, 'Service', {
    cluster,
    desiredTaskCount: 0,
    maxScalingCapacity: 2,
    memoryLimitMiB: 512,
    image: ecs.ContainerImage.fromRegistry('test'),
  });

  // THEN - QueueWorker is of EC2 launch type, an SQS queue is created and all default properties are set.
  expect(stack).toHaveResource('AWS::ECS::Service', {
    DesiredCount: 0,
    LaunchType: 'EC2',
  });
});

testDeprecated('throws if desiredTaskCount and maxScalingCapacity are 0', () => {
  // GIVEN
  const stack = new cdk.Stack();
  const vpc = new ec2.Vpc(stack, 'VPC');
  const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
  cluster.addAsgCapacityProvider(new AsgCapacityProvider(stack, 'DefaultAutoScalingGroupProvider', {
    autoScalingGroup: new AutoScalingGroup(stack, 'DefaultAutoScalingGroup', {
      vpc,
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: MachineImage.latestAmazonLinux(),
    }),
  }));

  // THEN
  expect(() =>
    new ecsPatterns.QueueProcessingEc2Service(stack, 'Service', {
      cluster,
      desiredTaskCount: 0,
      memoryLimitMiB: 512,
      image: ecs.ContainerImage.fromRegistry('test'),
    }),
  ).toThrow(/maxScalingCapacity must be set and greater than 0 if desiredCount is 0/);
});

test('can set custom containerName', () => {
  // GIVEN
  const stack = new cdk.Stack();
  const vpc = new ec2.Vpc(stack, 'VPC');
  const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
  cluster.addAsgCapacityProvider(new AsgCapacityProvider(stack, 'DefaultAutoScalingGroupProvider', {
    autoScalingGroup: new AutoScalingGroup(stack, 'DefaultAutoScalingGroup', {
      vpc,
      instanceType: new ec2.InstanceType('t2.micro'),
      machineImage: MachineImage.latestAmazonLinux(),
    }),
  }));

  // WHEN
  new ecsPatterns.QueueProcessingEc2Service(stack, 'Service', {
    cluster,
    memoryLimitMiB: 512,
    image: ecs.ContainerImage.fromRegistry('test'),
    containerName: 'my-container',
  });

  // THEN
  expect(stack).toHaveResourceLike('AWS::ECS::TaskDefinition', {
    ContainerDefinitions: [
      {
        Name: 'my-container',
      },
    ],
  });
});

test('can set capacity provider strategies', () => {
  // GIVEN
  const stack = new cdk.Stack();
  const vpc = new ec2.Vpc(stack, 'VPC');
  const cluster = new ecs.Cluster(stack, 'Cluster', { vpc });
  const autoScalingGroup = new autoscaling.AutoScalingGroup(stack, 'asg', {
    vpc,
    instanceType: new ec2.InstanceType('bogus'),
    machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
  });
  const capacityProvider = new ecs.AsgCapacityProvider(stack, 'provider', {
    autoScalingGroup,
  });
  cluster.addAsgCapacityProvider(capacityProvider);

  // WHEN
  new ecsPatterns.QueueProcessingEc2Service(stack, 'Service', {
    cluster,
    image: ecs.ContainerImage.fromRegistry('test'),
    memoryLimitMiB: 512,
    capacityProviderStrategies: [
      {
        capacityProvider: capacityProvider.capacityProviderName,
      },
    ],
  });

  // THEN
  expect(stack).toHaveResource('AWS::ECS::Service', {
    LaunchType: ABSENT,
    CapacityProviderStrategy: [
      {
        CapacityProvider: {
          Ref: 'providerD3FF4D3A',
        },
      },
    ],
  });
});