const { createInterface } = require('node:readline/promises');
const { 
  S3Client, 
  PutObjectCommand,
  CreateBucketCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteBucketCommand,
  paginateListObjectsV2
} = require('@aws-sdk/client-s3');
async function main() {
  // A region and credentials can be declared explicitly. For example
  // `new S3Client({ region: 'us-east-1', credentials: {...} })` would
  //initialize the client with those settings. However, the SDK will
  // use your local configuration and credentials if those properties
  // are not defined here.
  const s3Client = new S3Client({});

  // Create an Amazon S3 bucket. The epoch timestamp is appended
  // to the name to make it unique.
  const bucketName = `test-bucket-1748847271428`;
//   async function createBucket() {
//   const command = new CreateBucketCommand({ Bucket: "my-bucket-demo-98765" });
//   try {
//     const data = await s3.send(command);
//     console.log("Bucket created:", data);
//   } catch (err) {
//     console.error("Error creating bucket", err);
//   }
// }

// createBucket();
  await s3Client.send(
    new CreateBucketCommand({
      Bucket: bucketName,
    }),
  );
// import { PutObjectCommand } from "@aws-sdk/client-s3";
// import { readFileSync } from "fs";

// async function uploadFile() {
//   const command = new PutObjectCommand({
//     Bucket: "my-bucket-demo-98765",
//     Key: "hello.txt",
//     Body: readFileSync("./hello.txt"),
//   });

//   try {
//     const data = await s3.send(command);
//     console.log("File uploaded:", data);
//   } catch (err) {
//     console.error("Upload error", err);
//   }
// }

// uploadFile();
  // Put an object into an Amazon S3 bucket.
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: "my-first-object.txt",
      Body: readFileSync("./db.js"),
    }),
  );
// import { GetObjectCommand } from "@aws-sdk/client-s3";
// import { writeFile } from "fs/promises";
// import { Readable } from "stream";

// async function downloadFile() {
//   const command = new GetObjectCommand({
//     Bucket: "my-bucket-demo-98765",
//     Key: "hello.txt",
//   });

//   try {
//     const data = await s3.send(command);
//     const stream = data.Body as Readable;
//     const chunks = [];

//     for await (let chunk of stream) {
//       chunks.push(chunk);
//     }

//     await writeFile("downloaded-hello.txt", Buffer.concat(chunks));
//     console.log("File downloaded!");
//   } catch (err) {
//     console.error("Download error", err);
//   }
// }

// downloadFile();

  // Read the object.
  const { Body } = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: "my-first-object.txt",
    }),
  );

  console.log(await Body.transformToString());
// import { DeleteObjectCommand } from "@aws-sdk/client-s3";

// async function deleteFile() {
//   const command = new DeleteObjectCommand({
//     Bucket: "my-bucket-demo-98765",
//     Key: "hello.txt",
//   });

//   try {
//     await s3.send(command);
//     console.log("File deleted");
//   } catch (err) {
//     console.error("Delete error", err);
//   }
// }

// deleteFile();

  // Confirm resource deletion.
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const result = await prompt.question("Empty and delete bucket? (y/n) ");
  prompt.close();

  if (result === "y") {
    // Create an async iterator over lists of objects in a bucket.
    const paginator = paginateListObjectsV2(
      { client: s3Client },
      { Bucket: bucketName },
    );
    for await (const page of paginator) {
      const objects = page.Contents;
      if (objects) {
        // For every object in each page, delete it.
        for (const object of objects) {
          await s3Client.send(
            new DeleteObjectCommand({ Bucket: bucketName, Key: object.Key }),
          );
        }
      }
    }

    // Once all the objects are gone, the bucket can be deleted.
    await s3Client.send(new DeleteBucketCommand({ Bucket: bucketName }));
  }
}

// Call a function if this file was run directly. This allows the file
// to be runnable without running on import.
const { fileURLToPath } =require( "node:url");
const { dirname } = require('node:path');
if (process.argv[1] === __filename) {
  main();
}

// หรือใช้วิธีนี้เพื่อให้ทำงานทั้งในกรณีที่ถูก require และรันโดยตรง
if (require.main === module) {
  main();
}
module.exports = main;