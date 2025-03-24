## Serverless REST Assignment - Distributed Systems.

__Name:__ Shuobin Wang

__Demo:__ [Youtube](https://www.youtube.com/watch?v=kYOIvXWWKRs)

### Context.

This project implements a serverless REST API for managing a game library. The API allows clients to add new games, retrieve games (with optional filtering), update existing game records, and request translations of game summaries. The backend data is stored in a single DynamoDB table with a composite primary key.

**Table item attributes:**
+ **game_id** - number (Partition key)
+ **name** - string (Sort key)
+ **release_date** - string
+ **summary** - string (Main text attribute suitable for translation)
+ **meta_score** - number
+ **isEighthGen** - boolean
+ **platform** - string
+ **user_review** - number
+ **translations** - Map<string, string> (Stores cached translations, e.g., `{"fr": "..."}`)
+ **translatedSummary** - string (Optional, returned by the translation endpoint)

### App API endpoints.

- **POST /games**  
  Add a new game to the database.  
  _Protected_: Requires an API key in the `x-api-key` header.

- **GET /games**  
  Retrieve all game records.

- **GET /games/{gameId}**  
  Return all game records with the specified partition key value.

- **GET /games/{gameId}?platform=value**  
  Extended GET endpoint that supports query string parameters for filtering based on attributes (e.g. platform).

- **PUT /games/{gameId}/{name}**  
  Update an existing game item.  
  _Protected_: Requires an API key in the `x-api-key` header.

- **GET /games/{gameId}/{name}/translation?language=xx**  
  Retrieve a game item with its summary translated to a specified language (e.g. `fr` for French, `zh` for Chinese).  
  Translation requests are cached in the DynamoDB item under the `translations` attribute to avoid repeat calls to Amazon Translate.



### Features.

#### Translation persistence 

To reduce translation costs, the API caches translation results in the same DynamoDB table. When a translation request is made, the Lambda function first checks if a translation for the requested language exists in the `translations` map attribute. If present, it returns the cached result; otherwise, it invokes Amazon Translate, stores the new translation in the database, and then returns it. An example structure of a table item with translation caching is as follows:

```json
{
  "game_id": 4,
  "name": "SoulCalibur",
  "release_date": "8-Sep-99",
  "summary": "This is a tale of souls and swords, transcending the world and all its history...",
  "meta_score": 98,
  "isEighthGen": false,
  "platform": "Dreamcast",
  "user_review": 8.4,
  "translations": {
    "fr": "C'est une histoire d'âmes et d'épées, ...",
    "zh": "这是一个关于灵魂和剑的故事，..."
  },
  "translatedSummary": "C'est une histoire d'âmes et d'épées, ..."
}
```



#### API Keys. 

The POST and PUT endpoints are protected by API key authentication. In the CDK stack, an API key is created and associated with a usage plan. The corresponding API Gateway methods are configured with `apiKeyRequired: true`, ensuring that only requests with a valid API key (provided in the `x-api-key` header) can access these endpoints. For example:

~~~ts
gamesEndpoint.addMethod(
  "POST",
  new apig.LambdaIntegration(newGameFn, { proxy: true }),
  { apiKeyRequired: true }
);

updateResource.addMethod(
  "PUT",
  new apig.LambdaIntegration(updateGameFn, { proxy: true }),
  { apiKeyRequired: true }
);
~~~

###  Extra .

**DynamoDB Table Design:**
 A single table is used with a composite primary key (`game_id` as the partition key and `name` as the sort key). The table stores various scalar attributes as well as a `translations` map for caching translation responses.

**Amazon Translate Integration:**
 The API leverages Amazon Translate (with automatic language detection via Amazon Comprehend) to translate the game summary. Repeated translation requests for the same text are avoided by persisting translation results in the DynamoDB table.

**Seeding and Custom Resources:**
 A custom AWS resource is used to seed the DynamoDB table with initial game data upon deployment.
