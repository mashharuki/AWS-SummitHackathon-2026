import type { PersonaType } from "./enums";

/**
 * Persona entity (AI persona template)
 * DynamoDB: Personas table
 * PK: PERSONA#<personaId>
 * SK: DEFINITION (fixed value)
 *
 * Q9 answer: PersonaType = 'saboru' | 'amayakashi'
 * MVP v1.0.0 uses only 'saboru' (Ottori Saboru)
 */
export interface Persona {
  /** DynamoDB PK: PERSONA#<personaId> */
  PK: string;
  /** DynamoDB SK: DEFINITION (fixed value) */
  SK: "DEFINITION";
  /** Persona ID (e.g., 'saboru_ottori') */
  personaId: string;
  /** Persona type (Q9 answer) */
  type: PersonaType;
  /** Display name (e.g., "Ottori Saboru") */
  name: string;
  /** Bedrock prompt template */
  promptTemplate: string;
  /** Tone definition (endings, style) */
  tone: string;
  /** Emoji set */
  emojis: string[];
  /** Template version (integer) */
  version: number;
}
