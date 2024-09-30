import { APIGatewayProxyHandler } from 'aws-lambda';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const QuestionAnswer = z.object({
  question: z.string(),
  answer: z.string(),
});

const QuestionSet = z.object({
  questions: z.array(QuestionAnswer),
});

const BloomsTaxonomyLevels = [
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create"
] as const;

type BloomsTaxonomyLevel = typeof BloomsTaxonomyLevels[number];

export const openaiHandler: APIGatewayProxyHandler = async (event) => {
  try {
    const { lessonPlan, bloomsLevel } = JSON.parse(event.body || '{}');

    if (!lessonPlan || !bloomsLevel) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Lesson plan and Bloom\'s Taxonomy level are required' }),
      };
    }

    if (!BloomsTaxonomyLevels.includes(bloomsLevel as BloomsTaxonomyLevel)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid Bloom\'s Taxonomy level' }),
      };
    }

    const systemPrompt = `You are an expert educator specializing in creating questions that target specific cognitive skills based on Bloom's Taxonomy. Your task is to generate 10 questions and their correct answers based on the given lesson plan, focusing on the "${bloomsLevel}" level of Bloom's Taxonomy.

For the "${bloomsLevel}" level, create questions that:
${getBloomsTaxonomyPrompt(bloomsLevel as BloomsTaxonomyLevel)}

Ensure that the questions are diverse and cover different aspects of the lesson plan. You must generate exactly 10 questions, no more and no less.`;

    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-mini-2024-07-18",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Here's the lesson plan: ${lessonPlan}` }
      ],
      response_format: zodResponseFormat(QuestionSet, "question_set"),
    });

    const parsedResponse = completion.choices[0].message.parsed;

    // Check if parsedResponse is null
    if (parsedResponse === null) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to parse OpenAI response' }),
      };
    }

    // Post-parse validation to ensure we got 10 questions
    if (parsedResponse.questions.length !== 10) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: `Expected 10 questions, but received ${parsedResponse.questions.length}.`,
          partialResult: parsedResponse
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        result: parsedResponse,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

function getBloomsTaxonomyPrompt(level: BloomsTaxonomyLevel): string {
  switch (level) {
    case "Remember":
      return "Focus on recalling facts, terms, basic concepts, or answers. Use verbs like define, list, memorize, recall, repeat, name.";
    case "Understand":
      return "Demonstrate understanding of facts and ideas. Use verbs like classify, describe, discuss, explain, identify, locate, recognize, report, select, translate.";
    case "Apply":
      return "Solve problems by applying acquired knowledge, facts, techniques and rules in a different way. Use verbs like apply, build, choose, construct, develop, experiment with, identify, interview, make use of, model, organize, plan, select, solve, utilize.";
    case "Analyze":
      return "Examine and break information into parts by identifying motives or causes. Use verbs like analyze, categorize, classify, compare, contrast, discover, dissect, divide, examine, inspect, simplify, survey, take part in, test for, distinguish, list, distinction, theme, relationships, function, motive, inference, assumption, conclusion.";
    case "Evaluate":
      return "Present and defend opinions by making judgments about information, validity of ideas or quality of work based on a set of criteria. Use verbs like award, choose, conclude, criticize, decide, defend, determine, dispute, evaluate, judge, justify, measure, compare, mark, rate, recommend, rule on, select, agree, interpret, explain, appraise, prioritize, opinion, support, importance, criteria, prove, disprove, assess, influence, perceive, value, estimate, influence, deduct.";
    case "Create":
      return "Compile information together in a different way by combining elements in a new pattern or proposing alternative solutions. Use verbs like build, choose, combine, compile, compose, construct, create, design, develop, estimate, formulate, imagine, invent, make up, originate, plan, predict, propose, solve, solution, suppose, discuss, modify, change, original, improve, adapt, minimize, maximize, delete, theorize, elaborate, test, improve, happen, change.";
  }
}