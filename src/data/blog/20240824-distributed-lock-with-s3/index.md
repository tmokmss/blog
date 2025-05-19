---
author: Masashi Tomooka
pubDatetime: 2024-08-24T08:00:00Z
title: Implementing Distributed Locks with Amazon S3
slug: distributed-lock-with-s3
featured: false
draft: false
tags:
  - AWS
  - S3
  - Backend
  - Distributed Systems
description: Exploring how to implement distributed locks using Amazon S3's new conditional write feature, with a comparison to DynamoDB-based implementations.
---

Recently, Amazon S3 released a conditional write feature. In this article, we'll explore implementing distributed locks using this new capability.

[Amazon S3 now supports conditional writes - AWS](https://aws.amazon.com/about-aws/whats-new/2024/08/amazon-s3-conditional-writes/)

## What are Distributed Locks?

A distributed lock is a mechanism necessary for implementing mutual exclusion in distributed environments. It provides the functionality of a [lock](<https://en.wikipedia.org/wiki/Lock_(computer_science)>), but with the distinctive feature of being accessible from distributed environments[^1].

[Redis-based implementations](https://redis.io/docs/latest/develop/use/patterns/distributed-locks/) are well-known, but for AWS-native implementations, DynamoDB is commonly used. (Implementation examples: [DynamoDBLockClient](https://aws.amazon.com/blogs/database/building-distributed-locks-with-the-dynamodb-lock-client/), [Powertools for Lambda](https://docs.powertools.aws.dev/lambda/typescript/latest/utilities/idempotency/))

Distributed locks can be implemented with any storage system that supports conditional writes with strong consistency.

```
// Pseudocode for distributed lock
result = conditionalWrite(commonKey)
if (result == success) {
  // Lock acquired, proceed with main processing
  mainProcess()
  // Release the lock when done
  releaseLock()
} else {
  // Failed to acquire lock, retry or exit
}
```

Since S3's conditional write feature has [strong consistency](https://aws.amazon.com/s3/consistency/), we can implement distributed locks. The condition for "if a condition is met" becomes "if an object with the same key doesn't exist."

## Implementation with AWS SDK for JavaScript

Let's look at an example of implementing distributed locks with S3 using TypeScript. The following example shows 100 tasks competing for a lock:

```ts
import { S3 } from "@aws-sdk/client-s3";
import { setTimeout } from "timers/promises";

const s3 = new S3();
const key = ".lock";
const bucket = process.env.BUCKET;

const task = async (id: number) => {
  while (true) {
    // Vary timing between tasks
    await setTimeout(Math.random() * 500 + 500);

    try {
      // Try to acquire the lock
      await s3.putObject({
        Bucket: bucket,
        Key: key,
        IfNoneMatch: "*",
        Body: "\n",
      });
    } catch (e) {
      // Failed to acquire the lock, retry
      continue;
    }

    // Lock acquired successfully
    console.log(`acquired lock ${id}`);
    // Main process (just sleep in this example)
    await setTimeout(2000);
    // Release the lock
    console.log(`releasing lock ${id}`);
    await s3.deleteObject({
      Bucket: bucket,
      Key: key,
    });
  }
};

// Launch 100 tasks
new Array(100).fill(0).forEach((_, i) => {
  task(i);
});
```

All tasks use the same object key (in this case, `.lock`) as the lock object. This creates a situation where all tasks compete for a single lock.

Specifying `IfNoneMatch: '*'` in the [putObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html#API_PutObject_RequestSyntax) operation means that the object will be created if it doesn't exist, but an error will occur if it does exist. Because of strong consistency in writing, if multiple requests occur simultaneously, it's guaranteed that only one request will succeed.

A task that successfully acquires the lock creates an empty object called `.lock` in the S3 bucket, executes its main process, and then deletes that object from the bucket to release the lock.

### Execution Results

When run, we can observe the tasks competing for the lock while achieving mutual exclusion:

```
acquired lock 3
releasing lock 3
acquired lock 8
releasing lock 8
acquired lock 65
releasing lock 65
acquired lock 54
releasing lock 54
acquired lock 38
releasing lock 38
acquired lock 77
releasing lock 77
...
```

By the way, when lock acquisition fails, you'll get the following error:

```
PreconditionFailed: At least one of the pre-conditions you specified did not hold ... { '$fault': 'client', '$metadata': { httpStatusCode: 412, requestId: 'REDACTED', extendedRequestId: 'REDACTED, cfId: undefined, attempts: 1, totalRetryDelay: 0 }, Code: 'PreconditionFailed', Condition: 'If-None-Match', RequestId: 'REDACTED', HostId: 'REDACTED' }
```

In this example, all tasks are within the same process, so a distributed lock isn't even necessary, but it gives us a good overview of how it works.

## Practicality Considerations

Now that we've seen how to implement distributed locks using S3, let's consider some additional aspects of its practicality. Note that I'm not a distributed processing expert, so please correct me if I'm wrong! 🙇

### What About Lock Expiry?

In many distributed lock implementations, you can set an expiration (expiry) for the lock. This ensures that if a process that acquired the lock fails to release it for some reason, other processes can acquire the lock again after the set expiration time.

For example, with DynamoDB, you can use [inequalities and other operations](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.OperatorsAndFunctions.html#Expressions.OperatorsAndFunctions.Syntax) in conditional write conditions, making it possible to implement lock expiry.

With S3, the only condition available for writing is currently "whether the object already exists or not," making it difficult to implement expiry simply.

One approach would be to use [S3 lifecycle rules](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html), which can "automatically delete objects N days after they are created." Since deleting an object is equivalent to releasing a lock, this could be used to implement lock expiry. Additionally, processes that have acquired a lock could periodically rewrite the object to implement a heartbeat mechanism. However, since the expiry unit is per day (minimum of one day), use cases would be limited.

Alternatively, a separate worker could be set up to delete lock objects, checking "object creation time and deleting if the expiry is exceeded" (essentially a self-implementation of lifecycle rules). However, the [DeleteObject API](https://docs.aws.amazon.com/AmazonS3/latest/API/API_DeleteObject.html) doesn't currently support conditional deletion, making it difficult to completely avoid conflicts between delete and heartbeat requests. In practice, if heartbeats occur at intervals much shorter than the expiry, this shouldn't be a major issue (this is true even when using lifecycle rules).

Another solution might be to use [AWS Step Functions (SFn)](https://aws.amazon.com/step-functions/). By implementing lock acquisition, main processing, and lock release as separate [tasks](https://docs.aws.amazon.com/step-functions/latest/dg/state-task.html) in an SFn state machine, we can work under the assumption that the lock will always be released as long as SFn operates normally (without relying on expiry). In the unlikely event that a lock isn't released due to an S3 or SFn failure, manual recovery would be necessary.

This is definitely an important consideration, as there are fewer implementation options for expiry compared to DynamoDB or Redis.

### What About Costs?

Let's also consider costs. Based on the documentation, it seems that conditional writes don't change the cost, so the same cost as normal PUTs would apply. In this case, it's **$0.005 USD per 1000 requests** (in [us-east-1](https://aws.amazon.com/s3/pricing/)). The cost appears to be the same even when lock acquisition fails (based on [this documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ErrorCodeBilling.html) which lists error codes that aren't billed, but conditional write failures don't seem to be included).

How does this compare to DynamoDB? With [on-demand capacity pricing](https://aws.amazon.com/dynamodb/pricing/on-demand/), strongly consistent writes use two WRUs, so it's **$0.0025 USD per 1000 requests** ([same for acquisition failures](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/WorkingWithItems.html#WorkingWithItems.ConditionalUpdate)). This is exactly half the price of S3.

While DynamoDB has a cost advantage, both are quite inexpensive, so depending on the request volume, either might be acceptable.

### What About Request Rate?

How much load can the lock requests handle?

The [maximum request rate](https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html) for PUTs to an S3 partition is **3,500 RPS**.

For DynamoDB, the [limit is 1000 write units/s per partition](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html). Since strongly consistent writes consume two units, the limit would be **500 RPS**. This is about one-seventh of S3's capacity, revealing a surprising strength of S3.

Assuming ideal partition splitting in either case, each lock could handle that many RPS. While there are limits, they shouldn't be an issue for use cases that don't involve high RPS competition for locks.

## Conclusion

We've examined the implementation of distributed locks using S3. While DynamoDB remains sufficient for most cases, S3-based locks might be a valid option in situations where DynamoDB isn't desirable for some reason.

[^1]: Oddly enough, locks implemented with RDBMS such as MySQL aren't commonly referred to as distributed locks. The reason for this is a mystery.
