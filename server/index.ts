import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import {
  analyzeReferenceImage,
  generateAnimation,
  generateCharacterOptions,
  refineCharacterOptions,
} from './agent';
import { normalizeSpec } from '../src/lib/schemas';

const app = express();
const port = Number(process.env.API_PORT ?? 4174);
const root = process.cwd();

app.use(express.json({ limit: '30mb' }));

app.get('/api/health', (_request, response) => {
  response.json({
    ok: true,
    agent: 'opencode-cli',
    model: process.env.OPENCODE_MODEL ?? 'deepseek-v4.1-flash',
    provider: process.env.OPENCODE_PROVIDER ?? 'opencode-go',
  });
});

app.post('/api/agent/character', async (request, response) => {
  const prompt = typeof request.body?.prompt === 'string' ? request.body.prompt.trim() : '';
  const bodyPlan = ['humanoid', 'quadruped', 'blob'].includes(request.body?.bodyPlan)
    ? request.body.bodyPlan as 'humanoid' | 'quadruped' | 'blob'
    : undefined;
  if (!prompt) {
    response.status(400).json({ error: 'A character prompt is required.' });
    return;
  }
  try {
    response.json(await generateCharacterOptions(prompt, bodyPlan));
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Character generation failed.',
    });
  }
});

app.post('/api/agent/refine', async (request, response) => {
  const prompt = typeof request.body?.prompt === 'string' ? request.body.prompt.trim() : '';
  if (!prompt) {
    response.status(400).json({ error: 'A refinement prompt is required.' });
    return;
  }
  if (!request.body?.spec) {
    response.status(400).json({ error: 'The current character is required.' });
    return;
  }
  try {
    const spec = normalizeSpec(request.body.spec);
    const result = await refineCharacterOptions(
      prompt,
      spec,
      typeof request.body?.renderDataUrl === 'string' ? request.body.renderDataUrl : null,
    );
    response.json(result);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : 'Could not refine that character.',
    });
  }
});

app.post('/api/agent/animation', async (request, response) => {
  const prompt = typeof request.body?.prompt === 'string' ? request.body.prompt.trim() : '';
  if (!prompt) {
    response.status(400).json({ error: 'An animation prompt is required.' });
    return;
  }
  if (!request.body?.spec) {
    response.status(400).json({ error: 'The current character is required.' });
    return;
  }
  try {
    const spec = normalizeSpec(request.body.spec);
    const result = await generateAnimation(
      prompt,
      spec,
      typeof request.body?.preset === 'string' ? request.body.preset : undefined,
    );
    response.json(result);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : 'Could not generate that animation.',
    });
  }
});

app.post('/api/agent/analyze', async (request, response) => {
  const imageDataUrl = typeof request.body?.imageDataUrl === 'string' ? request.body.imageDataUrl : '';
  if (!imageDataUrl.startsWith('data:image/')) {
    response.status(400).json({ error: 'A full-character PNG is required.' });
    return;
  }
  try {
    response.json(await analyzeReferenceImage(imageDataUrl));
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Reference analysis failed.',
    });
  }
});

app.use(express.static(path.join(root, 'dist')));
app.use((request, response, next) => {
  if (request.path.startsWith('/api/')) {
    next();
    return;
  }
  const indexPath = path.join(root, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) response.sendFile(indexPath);
  else next();
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Isofoundry agent API listening on http://127.0.0.1:${port}`);
});
