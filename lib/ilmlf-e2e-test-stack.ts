import { Construct } from 'constructs';
import { Stack, StackProps, aws_iam, custom_resources, aws_codepipeline, aws_codecommit, aws_s3, aws_codebuild } from 'aws-cdk-lib';

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

    const codebuild = new aws_codebuild.Project(this, 'MyProject', {
      source: aws_codebuild.Source.codeCommit({ repository: repo }),
      buildSpec: aws_codebuild.BuildSpec.fromObject({
        version: '0.2',
        artifacts: {
          files: 'target/zip-with-dependencies.zip',
        },
        phases: {
          build: {
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
                },
              ],
            },
          ],
        },
      ],
    });
  }
}
