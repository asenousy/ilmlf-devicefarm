import { Construct } from 'constructs';
import {
  Stack,
  StackProps,
  aws_iam,
  custom_resources,
  aws_codepipeline,
  aws_codecommit,
  aws_codepipeline_actions,
  pipelines,
  aws_s3,
  CfnOutput,
  aws_codebuild,
} from 'aws-cdk-lib';
import { Source } from 'aws-cdk-lib/aws-codebuild';
import { SSL_OP_NETSCAPE_REUSE_CIPHER_CHANGE_BUG } from 'constants';

export class IlmlfE2ETestStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const devicefarm = new custom_resources.AwsCustomResource(this, 'DeviceFarm', {
      onCreate: {
        service: 'DeviceFarm',
        action: 'createProject',
        parameters: {
          name: 'mobile-test',
        },
        physicalResourceId: custom_resources.PhysicalResourceId.fromResponse('project.arn'),
      },
      onDelete: {
        service: 'DeviceFarm',
        action: 'deleteProject',
        parameters: {
          arn: new custom_resources.PhysicalResourceIdReference(),
        },
      },
      policy: custom_resources.AwsCustomResourcePolicy.fromSdkCalls({
        resources: custom_resources.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });

    const repoName = 'java-web';
    const repo = new aws_codecommit.Repository(this, 'RepoJava', {
      repositoryName: repoName,
      code: aws_codecommit.Code.fromDirectory('uiTest', 'main'),
    });

    const sourceOutput = new aws_codepipeline.Artifact('srcOuput');
    const buildOutput = new aws_codepipeline.Artifact('ooo');

    // const buildBucket = aws_s3.Bucket.fromBucketName(this, 'Output', buildOutput.bucketName);

    const codebuild = new aws_codebuild.Project(this, 'MyProject', {
      source: aws_codebuild.Source.codeCommit({ repository: repo }),
      // artifacts: aws_codebuild.Artifacts.s3({
      //   // bucket: buildBucket,
      //   // bucket,
      // }),
      // artifacts: aws_codebuild.Artifacts.s3({
      //   bucket: new aws_s3.Bucket(this, 'Hello', { bucketName: 'elsenousi' }),
      //   includeBuildId: false,
      //   path: 'aaa/bbb',
      // }),
      buildSpec: aws_codebuild.BuildSpec.fromObject({
        version: '0.2',
        artifacts: {
          // files: '**/*',
          files: 'target/zip-with-dependencies.zip',
          // files: 'test_bundle.zip',
          //   files: 'requirements.txt',
          //   name: 'aaa',
        },
        phases: {
          build: {
            // commands: ['ls', 'zip -r test_bundle.zip tests/ requirements.txt', 'ls'],
            commands: ['ls', 'mvn clean package -DskipTests=true', 'ls'],
          },
        },
      }),
    });
    codebuild.role?.addManagedPolicy(aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'));

    const pipelineRole = new aws_iam.Role(this, 'CodePipelineRole', {
      assumedBy: new aws_iam.ServicePrincipal('codepipeline.amazonaws.com'),
      managedPolicies: [aws_iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')],
    });

    // bucket.grantReadWrite(pipelineRole);
    // repo.grantRead(pipelineRole);
    // repo.grantPullPush(pipelineRole);

    const bucket = new aws_s3.Bucket(this, 'PipelineBucket');
    const codepipeline = new aws_codepipeline.CfnPipeline(this, 'Pipeline', {
      artifactStore: { type: 'S3', location: bucket.bucketName },
      name: 'cfn',
      roleArn: pipelineRole.roleArn,
      stages: [
        {
          name: 'Source',
          actions: [
            {
              name: 'MyRepositoryName',
              actionTypeId: {
                category: 'Source',
                owner: 'AWS',
                provider: 'CodeCommit',
                version: '1',
              },
              runOrder: 1,
              configuration: {
                BranchName: 'main',
                PollForSourceChanges: 'false',
                RepositoryName: repoName,
              },
              outputArtifacts: [
                {
                  name: sourceOutput.artifactName!,
                },
              ],
              // inputArtifacts: [],
            },
          ],
        },
        {
          name: 'Build',
          actions: [
            {
              actionTypeId: {
                category: 'Build',
                owner: 'AWS',
                provider: 'CodeBuild',
                version: '1',
              },
              configuration: {
                ProjectName: codebuild.projectName,
              },
              name: 'build',
              runOrder: 1,
              outputArtifacts: [
                {
                  name: buildOutput.artifactName!,
                  // name: 'ooo',
                },
              ],
              inputArtifacts: [
                {
                  name: sourceOutput.artifactName!,
                },
              ],
            },
          ],
        },
        {
          name: 'Test',
          actions: [
            {
              name: 'test',
              region: 'us-west-2',
              actionTypeId: {
                category: 'Test',
                owner: 'AWS',
                provider: 'DeviceFarm',
                version: '1',
              },
              configuration: {
                ProjectId: '9152545a-7b8b-4334-b47e-21bf0a0e5a5f',
                DevicePoolArn: 'arn:aws:devicefarm:us-west-2::devicepool:1c59cfd0-ee56-4443-b290-7a808d9fd885',
                AppType: 'Web',
                Test: 'target/zip-with-dependencies.zip',
                TestType: 'APPIUM_WEB_JAVA_TESTNG',
              },
              runOrder: 1,
              outputArtifacts: [],
              inputArtifacts: [
                {
                  name: buildOutput.artifactName!,
                  // name: 'ooo',
                },
              ],
            },
          ],
        },
      ],
    });

    // const codepipeline = new aws_codepipeline.Pipeline(this, 'CodePipeline', {});
    // const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
    //   codePipeline: codepipeline,
    //   synth: new pipelines.ShellStep('Synth', {
    //     input: pipelines.CodePipelineSource.codeCommit(repo, 'main'),
    //     commands: ['npm ci', 'npx cdk synth'],
    //   }),
    // });

    // const stages = new custom_resources.AwsCustomResource(this, 'Stages', {
    //   onCreate: {
    //     service: 'CodePipeline',
    //     action: 'updatePipeline',
    //     parameters: {
    //       name: 'ahmed',
    //       stages: [
    //         {
    //           actions: [
    //             {
    //               actionTypeId: {
    //                 category: 'Test',
    //                 owner: 'AWS',
    //                 provider: 'AWS Device Farm',
    //                 version: '1.0.0',
    //               },
    //               configuration: {
    //                 projectName: 'Demo',
    //                 devicePool: 'Top Devices',
    //                 appType: 'iOS',
    //                 appFilePath: 'hello.txt',
    //                 testType: 'Built-in: Fuzz',
    //               },
    //               inputArtifacts: [
    //                 {
    //                   name: 'Synth_Output',
    //                 },
    //               ],
    //               name: 'DeviceFarm',
    //             },
    //           ],
    //           name: 'Test',
    //         },
    //       ],
    //     },
    //     physicalResourceId: custom_resources.PhysicalResourceId.fromResponse('pipeline.name'),
    //   },
    //   policy: custom_resources.AwsCustomResourcePolicy.fromSdkCalls({
    //     resources: custom_resources.AwsCustomResourcePolicy.ANY_RESOURCE,
    //   }),
    // });

    // const sourceOutput = new aws_codepipeline.Artifact();
    // const pipeline = new codepipeline.Pipeline(this, 'MyFirstPipeline', {
    //   stages: [
    //     {
    //       stageName: 'Source',
    //       actions: [
    //         new codepipeline_actions.CodeCommitSourceAction({
    //           actionName: 'CodeCommit',
    //           repository: repo,
    //           output: sourceOutput,
    //         })
    //       ],
    //     },
    //     {
    //       stageName: 'Test',
    //       actions: [
    //         // {actionProperties: {actionName: 'DF', category: codepipeline.ActionCategory.TEST, provider: '', artifactBounds: {minInputs: 1, maxInputs: 1, minOutputs: 0, maxOutputs: 0}}}
    //       ]
    //     }
    //   ],
    // });

    // const codePipeline = aws_codepipeline.Pipeline.fromPipelineArn(this, 'cfnPipeline', 'arn:aws:codepipeline:us-west-2:053319678981:cfn');
    // const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
    //   synth: new pipelines.ShellStep('Synth', {
    //     input: pipelines.CodePipelineSource.codeCommit(repo, 'main'),
    //     commands: ['npm ci', 'npx cdk synth'],
    //   }),
    // });

    // const project = new aws_codebuild.PipelineProject(this, 'MyProject');

    // const sourceOutput = new aws_codepipeline.Artifact();
    // const sourceAction = new aws_codepipeline_actions.CodeCommitSourceAction({
    //   actionName: 'CodeCommit',
    //   repository: repo,
    //   branch: 'main',
    //   output: sourceOutput,
    // });
    // const buildAction = new aws_codepipeline_actions.CodeBuildAction({
    //   actionName: 'CodeBuild',
    //   project,
    //   input: sourceOutput,
    //   outputs: [new aws_codepipeline.Artifact()], // optional
    //   // executeBatchBuild: true, // optional, defaults to false
    //   // combineBatchBuildArtifacts: true, // optional, defaults to false
    // });

    // new aws_codepipeline.Pipeline(this, 'MyPipeline', {
    //   stages: [
    //     {
    //       stageName: 'Source',
    //       actions: [sourceAction],
    //     },
    //     {
    //       stageName: 'Build',
    //       actions: [buildAction],
    //     },
    //   ],
    // });
  }
}
