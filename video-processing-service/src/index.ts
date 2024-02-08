import express from 'express';
import { convertVideo,
   deleteProcessedVideo,
    deleteRawVideo,
     downloadRawVideo,
      setupDirectories,
       uploadProcessedVideo } from './storage';

setupDirectories();

const app = express();
app.use(express.json());

app.post('/process-video', async (req, res) => {
  // Get the bucket and filename from the cloud Pub/Sub message
  let data;
  try{
    const message = Buffer.from(req.body.message.data, 'base64').toString('utf8'); // takes message from cloud Pub/Sub
    data = JSON.parse(message); // Parses the message 
    if(!data.name){ // checks if name actually exists 
      throw new Error('Invalid message payload received');
    }
  }catch(error){
    console.error(error);
    return res.status(400).send('Bad Request:missing filename.'); // returns error
  }
  const inputFileName = data.name;
  const outputFileName = `processed-${inputFileName}`;

  //Downloading raw video from cloud storage
  await downloadRawVideo(inputFileName);

  // Convert video to 720p
  try{
    await convertVideo(inputFileName, outputFileName)
  }catch(err) {
    await Promise.all([
      deleteRawVideo(inputFileName),
      deleteProcessedVideo(outputFileName)
    ]);
    console.error(err);
    return res.status(500).send('Internal Server Error: Processing failed.');
  }

  //Upload the processed video to Cloud Storage 
  await uploadProcessedVideo(outputFileName);

  await Promise.all([
    deleteRawVideo(inputFileName),
    deleteProcessedVideo(outputFileName)
  ]);

  return res.status(200).send('Process Finished Successfully');
  
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port: ${port}`);
});
