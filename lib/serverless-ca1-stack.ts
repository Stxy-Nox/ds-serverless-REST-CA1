import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as custom from "aws-cdk-lib/custom-resources";
import * as apig from "aws-cdk-lib/aws-apigateway";
import { generateBatch } from "../shared/util";
import {games} from "../seed/games";

export class ServerlessCa1Stack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //Tables
    const gamesTable = new dynamodb.Table(this, "GamesTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "platform", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "game_id", type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      tableName: "Games",
    });

    //Funcitons
    const testFn = new lambdanode.NodejsFunction(this, "TestFn", {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: `${__dirname}/../lambdas/test.ts`,
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
    })

    new custom.AwsCustomResource(this, "moviesddbInitData", {
      onCreate: {
        service: "DynamoDB",
        action: "batchWriteItem",
        parameters: {
          RequestItems: {
            [gamesTable.tableName]: generateBatch(games),
          },
        },
        physicalResourceId: custom.PhysicalResourceId.of("moviesddbInitData"), //.of(Date.now().toString()),
      },
      policy: custom.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [gamesTable.tableArn],
      }),
    });

    //Permissions

    //REST API

    //Endpoints
  }
}
