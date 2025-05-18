export async function parseFileClient(
  file: File,
  sampleSize: number = 5
): Promise<Record<string, unknown>[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    try {
      const Papa = (await import('papaparse')).default;
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
          const headers = headerLine.split(',');
          const data = rows.slice(0, sampleSize).map((row) => {
            const values = row.split(',');
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

  if (extension === 'xlsx' || extension === 'xls') {
    const XLSX = await import('xlsx');
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = new Uint8Array(reader.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheet];
          const json = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
          const headers = json[0] as string[];
          const records = (json.slice(1, sampleSize + 1) as any[][]).map(
            (row) => {
              const obj: Record<string, unknown> = {};
              headers.forEach((h, i) => {
                obj[h] = row[i];
              });
              return obj;
            }
          );
          resolve(records);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  throw new Error('Unsupported file type');
}
