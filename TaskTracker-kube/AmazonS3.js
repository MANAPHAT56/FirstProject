import AWS from "aws-sdk";
import fs from "fs";

// ตั้งค่า AWS SDK
const s3 = new AWS.S3({
  accessKeyId: "YOUR_ACCESS_KEY",
  secretAccessKey: "YOUR_SECRET_KEY",
  region: "ap-southeast-1" // เปลี่ยนเป็นโซนที่เลือก
});

async function uploadFile(filePath, bucketName) {
  const fileContent = fs.readFileSync(filePath);
  const params = {
    Bucket: bucketName,
    Key: "uploads/" + filePath.split("/").pop(), // ตั้งชื่อไฟล์
    Body: fileContent,
    ACL: "public-read" // ตั้งให้ไฟล์เป็นสาธารณะ
  };

  try {
    const result = await s3.upload(params).promise();
    console.log("File uploaded:", result.Location);
    return result.Location;
  } catch (err) {
    console.error("Upload error:", err);
  }
}
function getFileUrl(bucketName, fileName) {
    return `https://${bucketName}.s3.amazonaws.com/uploads/${fileName}`;
  }
  
  console.log(getFileUrl("my-image-bucket", "test.jpg"));
  
// ใช้งาน
uploadFile("test.jpg", "my-image-bucket");
