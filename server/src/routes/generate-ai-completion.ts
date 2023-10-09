import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { openai } from '../lib/openai';
import { streamToResponse, OpenAIStream } from 'ai';

export async function generateAiCompletionRoute(app: FastifyInstance) {
  app.post('/ai/complete', async (req: FastifyRequest, rep: FastifyReply) => {
    const bodySchema = z.object({
      videoId: z.string().uuid(),
      prompt: z.string(),
      temperature: z.number().min(0).max(1).default(0.5),
    });

    const { videoId, prompt, temperature } = bodySchema.parse(req.body);

    const video = await prisma.video.findUniqueOrThrow({
      where: {
        id: videoId,
      },
    });

    if (!video.transcription) {
      return rep
        .status(400)
        .send({ error: 'Video transcription was not generate yet.' });
    }

    const promptMessage = prompt.replace(
      '{transcription}',
      video.transcription
    );

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-16k',
      temperature,
      messages: [
        {
          role: 'user',
          content: promptMessage,
        },
      ],
      stream: true,
    });

    const stream = OpenAIStream(response);

    streamToResponse(stream, rep.raw, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      },
    });
  });
}