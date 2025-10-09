import React, { useState } from 'react';
import { Upload, Download, Plus, Trash2, FileJson } from 'lucide-react';
import Papa from 'papaparse';

interface Mapping {
  csvColumn: string;
  jsonKey: string;
  isNumber: boolean;
  formatAsDate: boolean;
  removeSeparator: boolean;
}

interface CustomField {
  jsonKey: string;
  value: string;
  isNumber: boolean;
}

interface CsvRow {
  [key: string]: string;
}

interface JsonRow {
  [key: string]: string | number;
}

export default function CsvToJsonConverter() {
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([{ csvColumn: '', jsonKey: '', isNumber: false, formatAsDate: false, removeSeparator: false }]);
  const [jsonResult, setJsonResult] = useState<JsonRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [customFields, setCustomFields] = useState<CustomField[]>([{ jsonKey: '', value: '', isNumber: false }]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name.replace('.csv', ''));

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data as CsvRow[]);
        setHeaders(Object.keys((results.data[0] as CsvRow) || {}));
        setJsonResult(null);
      },
      error: (error) => {
        alert('Error parsing CSV: ' + error.message);
      }
    });
  };

  const addMapping = () => {
    setMappings([...mappings, { csvColumn: '', jsonKey: '', isNumber: false, formatAsDate: false, removeSeparator: false }]);
  };

  const removeMapping = (index: number) => {
    const newMappings = mappings.filter((_, i) => i !== index);
    setMappings(newMappings.length > 0 ? newMappings : [{ csvColumn: '', jsonKey: '', isNumber: false, formatAsDate: false, removeSeparator: false }]);
  };

  const updateMapping = (index: number, field: keyof Mapping, value: string | boolean) => {
    const newMappings = [...mappings];
    newMappings[index][field] = value as never;
    setMappings(newMappings);
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { jsonKey: '', value: '', isNumber: false }]);
  };

  const removeCustomField = (index: number) => {
    const newFields = customFields.filter((_, i) => i !== index);
    setCustomFields(newFields.length > 0 ? newFields : [{ jsonKey: '', value: '', isNumber: false }]);
  };

  const updateCustomField = (index: number, field: keyof CustomField, value: string | boolean) => {
    const newFields = [...customFields];
    newFields[index][field] = value as never;
    setCustomFields(newFields);
  };

  const onColumnChange = (index: number, column: string) => {
    const newMappings = [...mappings];
    newMappings[index].csvColumn = column;

    // Auto-detect if column contains "Date"
    if (column.toLowerCase().includes('date')) {
      newMappings[index].formatAsDate = true;
    }

    setMappings(newMappings);
  };

  const isDateColumn = (column: string) => {
    return column && column.toLowerCase().includes('date');
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return dateStr;

    // Try to parse various date formats
    const date = new Date(dateStr);

    if (isNaN(date.getTime())) {
      return dateStr; // Return original if parsing fails
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  };

  const removeSeparators = (value: string) => {
    if (!value) return value;
    // Remove dots, commas, and spaces (common number separators)
    return value.replace(/[.,\s]/g, '');
  };

  const convertToJson = () => {
    if (!csvData || csvData.length === 0) {
      alert('Silakan upload file CSV terlebih dahulu');
      return;
    }

    const validMappings = mappings.filter(m => m.csvColumn && m.jsonKey);

    if (validMappings.length === 0) {
      alert('Silakan tentukan minimal satu mapping column');
      return;
    }

    const result = csvData.map((row: CsvRow) => {
      const obj: JsonRow = {};

      // Add custom fields if both key and value are provided
      customFields.forEach(customField => {
        if (customField.jsonKey && customField.value) {
          obj[customField.jsonKey] = customField.isNumber
            ? parseFloat(customField.value)
            : customField.value;
        }
      });

      validMappings.forEach(mapping => {
        let value: string | number = row[mapping.csvColumn];

        // Remove separators if option is enabled (should be done first)
        if (mapping.removeSeparator) {
          value = removeSeparators(value as string);
        }

        // Format as date if option is enabled
        if (mapping.formatAsDate) {
          value = formatDate(value as string);
        }
        // Convert to number if option is enabled
        else if (mapping.isNumber) {
          const num = parseFloat(value as string);
          value = isNaN(num) ? value : num;
        }

        obj[mapping.jsonKey] = value;
      });

      return obj;
    });

    setJsonResult(result);
  };

  const downloadJson = () => {
    if (!jsonResult) return;

    const blob = new Blob([JSON.stringify(jsonResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName || 'output'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    if (!jsonResult) return;
    navigator.clipboard.writeText(JSON.stringify(jsonResult, null, 2));
    alert('JSON berhasil dicopy ke clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="flex items-center gap-3 mb-8">
            <FileJson className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-800">CSV to JSON Converter</h1>
          </div>

          {/* Upload Section */}
          <div className="mb-8">
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-indigo-300 rounded-lg cursor-pointer bg-indigo-50 hover:bg-indigo-100 transition">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-10 h-10 text-indigo-500 mb-2" />
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Click to upload</span> atau drag & drop
                </p>
                <p className="text-xs text-gray-500 mt-1">CSV files only</p>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {fileName && (
              <p className="mt-2 text-sm text-gray-600">File: <span className="font-semibold">{fileName}.csv</span></p>
            )}
          </div>

          {/* Custom Field Section */}
          {headers.length > 0 && (
            <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800">Custom Fields (Tidak dari CSV)</h3>
                <button
                  onClick={addCustomField}
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Field
                </button>
              </div>

              <div className="space-y-3">
                {customFields.map((field, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">JSON Key</label>
                      <input
                        type="text"
                        value={field.jsonKey}
                        onChange={(e) => updateCustomField(index, 'jsonKey', e.target.value)}
                        placeholder="Contoh: status"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                      <input
                        type="text"
                        value={field.value}
                        onChange={(e) => updateCustomField(index, 'value', e.target.value)}
                        placeholder="Masukkan value"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.isNumber}
                          onChange={(e) => updateCustomField(index, 'isNumber', e.target.checked)}
                          className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                        />
                        <span className="text-sm text-gray-700">Number</span>
                      </label>
                      <button
                        onClick={() => removeCustomField(index)}
                        disabled={customFields.length === 1}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500 mt-3">* Field ini akan ditambahkan ke setiap record JSON dengan value yang sama</p>
            </div>
          )}

          {/* Column Mapping */}
          {headers.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Column Mapping</h2>
                <button
                  onClick={addMapping}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Mapping
                </button>
              </div>

              <div className="space-y-4">
                {mappings.map((mapping, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex gap-3 items-start">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          CSV Column
                        </label>
                        <select
                          value={mapping.csvColumn}
                          onChange={(e) => onColumnChange(index, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                          <option value="">Pilih column...</option>
                          {headers.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          JSON Key
                        </label>
                        <input
                          type="text"
                          value={mapping.jsonKey}
                          onChange={(e) => updateMapping(index, 'jsonKey', e.target.value)}
                          placeholder="Nama key di JSON..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>

                      <button
                        onClick={() => removeMapping(index)}
                        className="mt-6 p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        disabled={mappings.length === 1}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Type and Date Format Options */}
                    <div className="mt-3 flex gap-4 items-center flex-wrap">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={mapping.removeSeparator}
                          onChange={(e) => updateMapping(index, 'removeSeparator', e.target.checked)}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700">Hapus Separator (. , spasi)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={mapping.isNumber}
                          onChange={(e) => updateMapping(index, 'isNumber', e.target.checked)}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700">Convert to Number</span>
                      </label>

                      {isDateColumn(mapping.csvColumn) && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={mapping.formatAsDate}
                            onChange={(e) => updateMapping(index, 'formatAsDate', e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <span className="text-sm text-gray-700">Format sebagai Tanggal (DD/MM/YYYY)</span>
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={convertToJson}
                className="mt-6 w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
              >
                Convert to JSON
              </button>
            </div>
          )}

          {/* JSON Result */}
          {jsonResult && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">
                  Result ({jsonResult.length} records)
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                  >
                    Copy
                  </button>
                  <button
                    onClick={downloadJson}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                  >
                    <Download className="w-4 h-4" />
                    Download JSON
                  </button>
                </div>
              </div>

              <div className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 font-mono text-sm">
                <pre>{JSON.stringify(jsonResult, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* Preview Data */}
          {csvData && csvData.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                CSV Preview (First 5 rows)
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300">
                  <thead className="bg-gray-100">
                    <tr>
                      {headers.map((header) => (
                        <th key={header} className="px-4 py-2 border border-gray-300 text-left text-sm font-semibold text-gray-700">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 5).map((row: CsvRow, idx: number) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {headers.map((header) => (
                          <td key={header} className="px-4 py-2 border border-gray-300 text-sm text-gray-600">
                            {row[header]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}