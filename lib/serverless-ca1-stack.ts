import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import * as apig from "aws-cdk-lib/aws-apigateway";

export class ServerlessCa1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //Tables


    //Funcitons
    const testFn = new lambdanode.NodejsFunction(this, "TestFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: `${__dirname}/../lambdas/test.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    })


    //Permissions

    //REST API

    //Endpoints
  }
}
