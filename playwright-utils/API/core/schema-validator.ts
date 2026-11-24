import fs from 'fs/promises'
import path from 'path'
import Ajv from 'ajv'

const SCHEMA_BASE_PATH = path.join(__dirname, '..', 'response-schemas')
const ajv = new Ajv({ allErrors: true })

export async function validateSchema(dirName: string, fileName: string, responseBody: unknown) {
  const schemaFile = `${fileName}_schema.json`
  const schema = await loadSchema(path.join(SCHEMA_BASE_PATH, dirName, schemaFile))
  const validate = ajv.compile(schema)

  if (!validate(responseBody)) {
    throw new Error(
      `Schema validation ${dirName}/${schemaFile} failed:\n` +
        `${JSON.stringify(validate.errors, null, 4)}\n\n` +
        `Actual response body:\n` +
        `${JSON.stringify(responseBody, null, 4)}`,
    )
  }
}

async function loadSchema(schemaPath: string): Promise<object> {
  try {
    return JSON.parse(await fs.readFile(schemaPath, 'utf-8'))
  } catch (error) {
    throw new Error(`Failed to read the schema file ${schemaPath}: ${(error as Error).message}`)
  }
}
