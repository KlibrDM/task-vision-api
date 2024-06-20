import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import routes from './routes/routes';
import mongoose from "mongoose";
import { WSS } from "./webSocketServer";

dotenv.config();

const app: Express = express();
const port = process.env.API_PORT || 6060;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI!, {
  autoIndex: true,
  ignoreUndefined: true,
});

mongoose.connection.on('connected', () => {
  console.log('Connected to MongoDB');
});

// Parse the request
app.use(express.urlencoded({ extended: false }));
app.use(express.json({limit: '100mb'}));

// CORS rules for the API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'origin, X-Requested-With,Content-Type,Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET, PUT, PATCH, DELETE, POST');
    return res.status(200).json({});
  }
  next();
});

// Routes
app.use('/', routes);

// Error handling
app.use((req, res, next) => {
  const error = new Error('not found');
  return res.status(404).json({ message: error.message });
});

const server = app.listen(port, () => {
  console.log(`The server is running on port ${port}`);
});

// Create WebSocket Server
export const ws = new WSS(server);
