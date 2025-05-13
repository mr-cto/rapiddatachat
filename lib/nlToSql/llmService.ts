import OpenAI from "openai";

/**
 * LLM response interface
 */
export interface LLMResponse {
  sql: string;
  explanation: string;
  error?: string;
}

/**
 * LLM service configuration
 */
export interface LLMServiceConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

/**
 * LLM service for translating natural language to SQL
 */
export class LLMService {
  private openai: OpenAI;
  private config: LLMServiceConfig;

  /**
   * Create a new LLM service
   * @param apiKey OpenAI API key
   * @param config LLM service configuration
   */
  constructor(apiKey: string, config: LLMServiceConfig) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
    this.config = config;
  }

  /**
   * Translate a natural language query to SQL
   * @param query Natural language query
   * @param schemaInfo Database schema information
   * @param sampleData Sample data from the database
   * @returns Promise<LLMResponse> SQL query and explanation
   */
  async translateToSQL(
    query: string,
    schemaInfo: string,
    sampleData?: string
  ): Promise<LLMResponse> {
    try {
      console.log(`[LLMService] Translating query to SQL: "${query}"`);
      console.log(
        `[LLMService] Schema info length: ${schemaInfo.length} characters`
      );
      console.log(
        `[LLMService] Sample data provided: ${sampleData ? "yes" : "no"}`
      );

      // Create the prompt for the LLM
      console.log("[LLMService] Creating prompt for LLM");
      const prompt = this.createPrompt(query, schemaInfo, sampleData);
      console.log(
        `[LLMService] Prompt created (length: ${prompt.length} characters)`
      );

      // Call the OpenAI API
      console.log(
        `[LLMService] Calling OpenAI API with model: ${this.config.model}`
      );
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: "system",
            content:
              "You are a SQL expert that translates natural language questions into SQL queries. " +
              "You will be provided with database schema information and a natural language question. " +
              "Your task is to generate a valid PostgreSQL query that answers the question. " +
              "IMPORTANT: You must ONLY generate SELECT queries. Do not generate INSERT, UPDATE, DELETE, or any other modifying queries. " +
              "IMPORTANT: The data is stored in a JSONB column named 'data', but the actual values are directly in this column, not in a nested field. " +
              "For example, if the original CSV had columns like 'name', 'email', etc., they would be accessed as data->>'name', data->>'email', etc. " +
              "DO NOT use data->>'data' as this is incorrect - the fields are directly in the data column. " +
              "When using string functions like SPLIT_PART, always cast JSONB to text first using ::text. " +
              "CRITICAL: Always use the EXACT table names as provided in the 'SQL Name' field of the schema information. " +
              "DO NOT use the original file name as the table name. " +
              "DO NOT add quotes around the table name unless it contains special characters. " +
              "CRITICAL: The table name MUST be exactly as shown in the 'SQL Name' field, with no modifications. " +
              "IMPORTANT: Before extracting parts from data, first check if the data actually contains what the user is looking for. " +
              "For example, if asked to extract email parts, first check if the data contains '@' symbol using a WHERE clause. " +
              "IMPORTANT: The schema information will include a list of available fields in the data column. " +
              "ONLY use fields that are explicitly listed as available. " +
              "If the user asks for fields that don't exist in the data, use string manipulation functions on existing fields or " +
              "create derived fields based on available data. For example, if 'email' exists but 'first_name' doesn't, " +
              "you could extract the first part of the email as a substitute for first name. " +
              "IMPORTANT: For Excel files, be aware that column names might be capitalized (e.g., 'Name' instead of 'name'). " +
              "Try variations of field names if needed (e.g., data->>'Name', data->>'EMAIL', data->>'Email'). " +
              "IMPORTANT: If you're unsure about the data structure, first generate a query to examine it: " +
              "SELECT data FROM [table_name] LIMIT 5; " +
              "IMPORTANT: Be creative and intelligent in your approach to answering queries. The data could be about anything - " +
              "people, products, events, financial data, etc. Analyze the available fields and sample data to determine the best " +
              "approach for each specific query. " +
              "IMPORTANT: For complex queries that might require sophisticated logic: " +
              "1. Use proper parentheses to ensure correct operator precedence " +
              "2. Consider using PostgreSQL's array functions and operators when appropriate " +
              "3. Use pattern matching efficiently with LIKE, ILIKE, or regular expressions " +
              "4. Leverage PostgreSQL's text manipulation functions when needed " +
              "5. For queries that might result in large IN clauses, use pattern matching or other techniques to avoid token limitations " +
              "IMPORTANT: Return ONLY the raw SQL query without any markdown formatting, explanations, or comments. " +
              "Do not use code blocks, do not include the word 'SQL' or any other text - just return the raw query.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        top_p: this.config.topP,
        frequency_penalty: this.config.frequencyPenalty,
        presence_penalty: this.config.presencePenalty,
      });
      console.log("[LLMService] Received response from OpenAI API");

      // Extract the SQL query and explanation from the response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.error("[LLMService] No content in LLM response");
        throw new Error("No response from LLM");
      }
      console.log(
        `[LLMService] Response content length: ${content.length} characters`
      );

      // Parse the response to extract the SQL query and explanation
      console.log(
        "[LLMService] Parsing response to extract SQL and explanation"
      );
      const parsedResponse = this.parseResponse(content);

      // Log the generated SQL for debugging
      console.log(`[LLMService] Generated SQL query: ${parsedResponse.sql}`);
      console.log(
        `[LLMService] Explanation length: ${parsedResponse.explanation.length} characters`
      );

      return parsedResponse;
    } catch (error) {
      console.error("[LLMService] Error translating to SQL:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[LLMService] Error details: ${errorMessage}`);
      console.error(`[LLMService] Query: "${query}"`);
      return {
        sql: "",
        explanation: `Error translating to SQL: ${errorMessage}`,
      };
    }
  }

  /**
   * Create a prompt for the LLM
   * @param query Natural language query
   * @param schemaInfo Database schema information
   * @param sampleData Sample data from the database
   * @returns string Prompt for the LLM
   */
  private createPrompt(
    query: string,
    schemaInfo: string,
    sampleData?: string
  ): string {
    // Create a prompt for the LLM
    const prompt = `
# Database Schema
${schemaInfo}

${
  sampleData
    ? `
# Sample Data
${sampleData}
`
    : ""
}

# Guidelines
    - IMPORTANT: The data is stored in a JSONB column named "data", but the actual values are directly in this column, not in a nested field.
    - For example, if the original CSV had columns like "name", "email", etc., they would be accessed as data->>'name', data->>'email', etc.
    - DO NOT use data->>'data' as this is incorrect - the fields are directly in the data column.
    - When using string functions like SPLIT_PART, always cast JSONB to text first using ::text.
    - Example: data->>'email' to access the 'email' field as text
    - Example: data->>'email'::text to cast the 'email' field to text for string operations
    - Only generate SELECT queries. Do not generate INSERT, UPDATE, DELETE, or any other modifying queries.
    - IMPORTANT: Before extracting parts from data, first check if the data actually contains what the user is looking for.
    - For example, if asked to extract email parts, first check if the data contains '@' symbol using a WHERE clause.
    
    # Advanced Query Techniques
    
    - For complex queries, use proper parentheses to ensure correct operator precedence
    - Consider using PostgreSQL's array functions and operators when appropriate
    - Use pattern matching efficiently with LIKE, ILIKE, or regular expressions
    - Leverage PostgreSQL's text manipulation functions when needed
    - For queries that might result in large IN clauses, use pattern matching or other techniques
    
    # Output Format
    IMPORTANT: Return ONLY the raw SQL query without any markdown formatting, explanations, or comments.
    Do not use code blocks, do not include the word 'SQL' or any other text - just return the raw query.

# Question
${query}
`;

    return prompt;
  }

  /**
   * Parse the response from the LLM
   * @param content Response content from the LLM
   * @returns LLMResponse SQL query and explanation
   */
  private parseResponse(content: string): LLMResponse {
    console.log("[LLMService] Parsing LLM response");
    console.log("[LLMService] Full response content:");
    console.log(content);

    // Clean up the response
    let sql = content.trim();

    // Remove markdown code blocks if present
    if (sql.startsWith("```") && sql.endsWith("```")) {
      sql = sql.substring(3, sql.length - 3).trim();
    }

    // Remove language identifier if present
    if (sql.startsWith("sql") || sql.startsWith("SQL")) {
      sql = sql.substring(3).trim();
    }

    console.log("[LLMService] Final cleaned SQL:", sql);

    return {
      sql,
      explanation: "Generated SQL query based on your question.",
    };
  }
}

/**
 * Create an instance of the LLM service
 * @param apiKey OpenAI API key
 * @param config LLM service configuration
 * @returns LLMService instance
 */
export function createLLMService(
  apiKey: string,
  config: LLMServiceConfig
): LLMService {
  return new LLMService(apiKey, config);
}
