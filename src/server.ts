import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express'
import { prisma } from './config/db/prisma';
import routes from './routes/index'
import { swaggerSpec } from './config/swagger/swagger';
import bcrypt from "bcrypt";
import { RoleType } from '@prisma/client';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', routes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/swagger.json", (req, res) => res.json(swaggerSpec));

// Health check route
app.get('/health', (req, res) => {
	console.log('Health check endpoint hit');
	res.json({ status: 'ok' });
});


// Seed normal Super Admin user and SYSTEM role (POST /seed-super-admin)

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`✅ Server running on port ${PORT}`);
});