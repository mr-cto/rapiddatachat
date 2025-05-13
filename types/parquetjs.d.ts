declare module "parquetjs" {
  export class ParquetSchema {
    constructor(schema: Record<string, any>);
    fields: Record<string, any>;
  }

  export class ParquetWriter {
    static openFile(
      schema: ParquetSchema,
      path: string
    ): Promise<ParquetWriter>;
    appendRow(row: Record<string, any>): Promise<void>;
    close(): Promise<void>;
  }

  export class ParquetReader {
    static openFile(path: string): Promise<ParquetReader>;
    schema: ParquetSchema;
    getCursor(): ParquetCursor;
    close(): Promise<void>;
  }

  export class ParquetCursor {
    next(): Promise<Record<string, any> | null>;
  }
}
