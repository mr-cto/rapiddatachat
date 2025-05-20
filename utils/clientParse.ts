export async function parseFileClient(
  file: File,
  sampleSize: number = 5
): Promise<Record<string, unknown>[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    try {
      const Papa = (await import("papaparse")).default;
      return new Promise((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          preview: sampleSize,
          skipEmptyLines: true,
          complete: (results: { data: Record<string, unknown>[] }) => {
            resolve(results.data);
          },
          error: (err: unknown) => reject(err),
        });
      });
    } catch {
      // Fallback simple CSV parser if papaparse is unavailable
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const text = reader.result as string;
          const [headerLine, ...rows] = text.split(/\r?\n/).filter(Boolean);
          const headers = headerLine.split(",");
          const data = rows.slice(0, sampleSize).map((row) => {
            const values = row.split(",");
            const obj: Record<string, unknown> = {};
            headers.forEach((h, i) => {
              obj[h] = values[i];
            });
            return obj;
          });
          resolve(data);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });
    }
  }

  if (extension === "xlsx" || extension === "xls") {
    console.log(
      `Parsing XLSX/XLS file: ${file.name}, size: ${file.size} bytes`
    );
    const XLSX = await import("xlsx");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          console.log(
            `FileReader loaded ${
              file.name
            }, result type: ${typeof reader.result}`
          );

          if (!(reader.result instanceof ArrayBuffer)) {
            throw new Error(
              "Expected ArrayBuffer but got different result type"
            );
          }

          const data = new Uint8Array(reader.result);
          console.log(`Processing ${data.length} bytes of XLSX data`);

          // Use proper options for XLSX parsing with more debug info
          const workbook = XLSX.read(data, {
            type: "array",
            cellDates: true, // Convert date cells to JS dates
            cellNF: false, // Don't include number formats
            cellText: false, // Don't include rich text
            WTF: true, // Output more debug info
          });

          console.log(
            `XLSX parsed successfully. Sheets: ${workbook.SheetNames.join(
              ", "
            )}`
          );

          if (workbook.SheetNames.length === 0) {
            throw new Error("No sheets found in XLSX file");
          }

          const sheet = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheet];

          if (!worksheet) {
            throw new Error(`Worksheet '${sheet}' not found`);
          }

          console.log(`Using worksheet: ${sheet}, ref: ${worksheet["!ref"]}`);

          // Use sheet_to_json with proper options and error handling
          try {
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
              raw: false, // Convert values to appropriate types
              dateNF: "yyyy-mm-dd", // Date format
              defval: null, // Default value for empty cells
              blankrows: false, // Skip blank rows
            });

            console.log(
              `Converted to JSON successfully. Row count: ${jsonData.length}`
            );

            if (jsonData.length === 0) {
              console.warn("No data rows found in XLSX file");
              resolve([]);
              return;
            }

            // Limit to sample size
            const records = jsonData.slice(0, sampleSize).map((row: any) => {
              const processedRow: Record<string, unknown> = {};

              // Process each field in the row to ensure consistent types
              for (const [key, value] of Object.entries(row)) {
                if (value instanceof Date) {
                  // Convert dates to ISO strings for consistency
                  processedRow[key] = value.toISOString();
                } else if (value === undefined) {
                  // Convert undefined to null
                  processedRow[key] = null;
                } else {
                  processedRow[key] = value;
                }
              }

              return processedRow;
            });

            console.log(`Returning ${records.length} processed records`);
            resolve(records);
          } catch (jsonErr) {
            console.error("Error converting worksheet to JSON:", jsonErr);

            // Fallback to simpler parsing method
            console.log("Attempting fallback parsing method...");
            const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
            const headers: string[] = [];

            // Extract headers from first row
            for (let c = range.s.c; c <= range.e.c; c++) {
              const cell =
                worksheet[XLSX.utils.encode_cell({ r: range.s.r, c })];
              headers.push(cell && cell.v ? String(cell.v) : `Column${c + 1}`);
            }

            console.log(
              `Extracted ${headers.length} headers: ${headers.join(", ")}`
            );

            // Extract data rows
            const records: Record<string, unknown>[] = [];
            const rowLimit = Math.min(range.e.r, range.s.r + sampleSize);

            for (let r = range.s.r + 1; r <= rowLimit; r++) {
              const record: Record<string, unknown> = {};

              for (let c = range.s.c; c <= range.e.c; c++) {
                const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
                const header = headers[c - range.s.c];

                if (header) {
                  record[header] = cell ? cell.v : null;
                }
              }

              records.push(record);
            }

            console.log(`Fallback method extracted ${records.length} rows`);
            resolve(records);
          }
        } catch (err) {
          console.error(
            `Error parsing XLSX file: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
          reject(err);
        }
      };
      reader.onerror = (event) => {
        console.error(`FileReader error: ${reader.error}`);
        reject(reader.error);
      };

      // Ensure we're reading as ArrayBuffer
      console.log(`Starting to read ${file.name} as ArrayBuffer`);
      reader.readAsArrayBuffer(file);
    });
  }

  throw new Error("Unsupported file type");
}
