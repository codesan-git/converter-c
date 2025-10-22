import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Upload, FileText, AlertCircle, Download, Search, Key, Settings, Loader } from 'lucide-react';
import Papa from 'papaparse';

// Type definitions
interface CSVRow {
  [key: string]: string | number | boolean | null | undefined;
}

interface Difference {
  column: string;
  val1: string | number | boolean | null | undefined;
  val2: string | number | boolean | null | undefined;
  onlyInFile1: boolean;
  onlyInFile2: boolean;
}

interface ComparisonResult {
  file1Index: number | null;
  file2Index: number | null;
  status: 'match' | 'different' | 'onlyInFile1' | 'onlyInFile2';
  keyValues: Record<string, string | number | boolean | null | undefined>;
  differences: Difference[];
}

// Web Worker code as string
const workerCode = `
  self.onmessage = function(e) {
    const { type, data } = e.data;
    
    if (type === 'compare') {
      const { file1Data, file2Data, keyColumns, matchingMode } = data;
      
      try {
        let results;
        if (matchingMode === 'keyBased' && keyColumns.length > 0) {
          results = getKeyBasedComparison(file1Data, file2Data, keyColumns);
        } else {
          results = getRowByRowComparison(file1Data, file2Data);
        }
        
        self.postMessage({ type: 'complete', data: results });
      } catch (error) {
        self.postMessage({ type: 'error', error: error.message });
      }
    }
  };
  
  function createKeyString(row, keys) {
    return keys.map(k => String(row[k] ?? '')).join('|||');
  }
  
  function getKeyBasedComparison(file1Data, file2Data, keyColumns) {
    const file2Map = new Map();
    file2Data.forEach((row, idx) => {
      const key = createKeyString(row, keyColumns);
      if (!file2Map.has(key)) {
        file2Map.set(key, { row, originalIndex: idx });
      }
    });

    const results = [];
    const matchedFile2Keys = new Set();
    const allHeaders = [...new Set([
      ...Object.keys(file1Data[0] || {}),
      ...Object.keys(file2Data[0] || {})
    ])];

    file1Data.forEach((row1, idx1) => {
      const key = createKeyString(row1, keyColumns);
      const file2Match = file2Map.get(key);

      if (file2Match) {
        matchedFile2Keys.add(key);
        
        const differences = [];
        let hasDifference = false;

        allHeaders.forEach(header => {
          if (keyColumns.includes(header)) return;
          
          const val1 = row1[header];
          const val2 = file2Match.row[header];
          
          if (val1 !== val2) {
            hasDifference = true;
            differences.push({
              column: header,
              val1: val1 ?? '',
              val2: val2 ?? '',
              onlyInFile1: val1 !== undefined && val2 === undefined,
              onlyInFile2: val2 !== undefined && val1 === undefined
            });
          }
        });

        results.push({
          file1Index: idx1,
          file2Index: file2Match.originalIndex,
          status: hasDifference ? 'different' : 'match',
          keyValues: keyColumns.reduce((acc, k) => ({ ...acc, [k]: row1[k] }), {}),
          differences
        });
      } else {
        results.push({
          file1Index: idx1,
          file2Index: null,
          status: 'onlyInFile1',
          keyValues: keyColumns.reduce((acc, k) => ({ ...acc, [k]: row1[k] }), {}),
          differences: []
        });
      }
      
      if (idx1 % 1000 === 0) {
        self.postMessage({ 
          type: 'progress', 
          progress: Math.round((idx1 / file1Data.length) * 50)
        });
      }
    });

    file2Data.forEach((row2, idx2) => {
      const key = createKeyString(row2, keyColumns);
      if (!matchedFile2Keys.has(key)) {
        results.push({
          file1Index: null,
          file2Index: idx2,
          status: 'onlyInFile2',
          keyValues: keyColumns.reduce((acc, k) => ({ ...acc, [k]: row2[k] }), {}),
          differences: []
        });
      }
      
      if (idx2 % 1000 === 0) {
        self.postMessage({ 
          type: 'progress', 
          progress: 50 + Math.round((idx2 / file2Data.length) * 50)
        });
      }
    });

    return results;
  }
  
  function getRowByRowComparison(file1Data, file2Data) {
    const results = [];
    const maxRows = Math.max(file1Data.length, file2Data.length);
    const allHeaders = [...new Set([
      ...Object.keys(file1Data[0] || {}),
      ...Object.keys(file2Data[0] || {})
    ])];

    for (let i = 0; i < maxRows; i++) {
      const row1 = file1Data[i];
      const row2 = file2Data[i];

      if (!row1) {
        results.push({
          file1Index: null,
          file2Index: i,
          status: 'onlyInFile2',
          keyValues: {},
          differences: []
        });
      } else if (!row2) {
        results.push({
          file1Index: i,
          file2Index: null,
          status: 'onlyInFile1',
          keyValues: {},
          differences: []
        });
      } else {
        const differences = [];
        let hasDifference = false;

        allHeaders.forEach(header => {
          const val1 = row1[header];
          const val2 = row2[header];
          
          if (val1 !== val2) {
            hasDifference = true;
            differences.push({
              column: header,
              val1: val1 ?? '',
              val2: val2 ?? '',
              onlyInFile1: val1 !== undefined && val2 === undefined,
              onlyInFile2: val2 !== undefined && val1 === undefined
            });
          }
        });

        results.push({
          file1Index: i,
          file2Index: i,
          status: hasDifference ? 'different' : 'match',
          keyValues: {},
          differences
        });
      }
      
      if (i % 1000 === 0) {
        self.postMessage({ 
          type: 'progress', 
          progress: Math.round((i / maxRows) * 100)
        });
      }
    }

    return results;
  }
`;

export default function CSVComparator() {
  const [file1Data, setFile1Data] = useState<CSVRow[] | null>(null);
  const [file2Data, setFile2Data] = useState<CSVRow[] | null>(null);
  const [file1Name, setFile1Name] = useState('');
  const [file2Name, setFile2Name] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'match' | 'different' | 'differences' | 'onlyFile1' | 'onlyFile2'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [keyColumns, setKeyColumns] = useState<string[]>([]);
  const [showKeySelection, setShowKeySelection] = useState(false);
  const [matchingMode, setMatchingMode] = useState<'rowByRow' | 'keyBased'>('rowByRow');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const isComparingRef = useRef(false);

  // Initialize worker
  useEffect(() => {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    workerRef.current = new Worker(workerUrl);

    workerRef.current.onmessage = (e: MessageEvent<{ type: string; data?: ComparisonResult[]; progress?: number; error?: string }>) => {
      const { type, data, progress, error } = e.data;

      if (type === 'complete' && data) {
        setComparisonResults(data);
        setIsProcessing(false);
        setProcessingProgress(0);
        isComparingRef.current = false;
        setError(null);
      } else if (type === 'progress' && progress !== undefined) {
        setProcessingProgress(progress);
      } else if (type === 'error') {
        console.error('Worker error:', error);
        setIsProcessing(false);
        setProcessingProgress(0);
        isComparingRef.current = false;
        setError('Error processing data: ' + error);
      }
    };

    workerRef.current.onerror = (error: ErrorEvent) => {
      console.error('Worker error:', error);
      setIsProcessing(false);
      setProcessingProgress(0);
      isComparingRef.current = false;
      setError('Worker error occurred');
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        URL.revokeObjectURL(workerUrl);
      }
    };
  }, []);

  // Trigger comparison when data or settings change
  useEffect(() => {
    if (file1Data && file2Data && workerRef.current && !isComparingRef.current) {
      isComparingRef.current = true;
      setIsProcessing(true);
      setProcessingProgress(0);
      setDisplayLimit(100);
      setError(null);

      // Small delay to ensure UI updates
      const timeoutId = setTimeout(() => {
        if (workerRef.current) {
          workerRef.current.postMessage({
            type: 'compare',
            data: {
              file1Data,
              file2Data,
              keyColumns,
              matchingMode
            }
          });
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [file1Data, file2Data, keyColumns, matchingMode]);

  const parseCSV = useCallback((file: File, setData: React.Dispatch<React.SetStateAction<CSVRow[] | null>>, setName: React.Dispatch<React.SetStateAction<string>>) => {
    if (!file) return;

    setName(file.name);
    setError(null);

    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          setError('Invalid file format');
          return;
        }

        console.log('File loaded, size:', text.length, 'chars');

        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (results: Papa.ParseResult<CSVRow>) => {
            console.log('Parse complete:', results.data.length, 'rows');
            if (results.errors.length > 0) {
              console.warn('Parse warnings:', results.errors);
            }
            setData(results.data);
          },
          error: (error: Error) => {
            console.error('Parse error:', error);
            setError('Error parsing CSV: ' + error.message);
          }
        });
      } catch (error) {
        console.error('File read error:', error);
        setError('Error reading file: ' + (error instanceof Error ? error.message : String(error)));
      }
    };

    reader.onerror = () => {
      setError('Error reading file');
    };

    reader.readAsText(file);
  }, []);

  const commonHeaders = useMemo(() => {
    if (!file1Data || !file2Data) return [];
    const headers1 = Object.keys(file1Data[0] || {});
    const headers2 = Object.keys(file2Data[0] || {});
    return headers1.filter(h => headers2.includes(h));
  }, [file1Data, file2Data]);

  const toggleKeyColumn = useCallback((column: string) => {
    if (isProcessing) return;
    setKeyColumns(prev =>
      prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column]
    );
  }, [isProcessing]);

  const filteredResults = useMemo(() => {
    let results = comparisonResults;

    if (filterMode === 'match') {
      results = results.filter(r => r.status === 'match');
    } else if (filterMode === 'different') {
      results = results.filter(r => r.status === 'different');
    } else if (filterMode === 'onlyFile1') {
      results = results.filter(r => r.status === 'onlyInFile1');
    } else if (filterMode === 'onlyFile2') {
      results = results.filter(r => r.status === 'onlyInFile2');
    } else if (filterMode === 'differences') {
      results = results.filter(r => r.status !== 'match');
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      results = results.filter(result => {
        const keyMatch = Object.values(result.keyValues).some(val =>
          String(val).toLowerCase().includes(searchLower)
        );

        const diffMatch = result.differences.some(diff =>
          String(diff.val1).toLowerCase().includes(searchLower) ||
          String(diff.val2).toLowerCase().includes(searchLower) ||
          diff.column.toLowerCase().includes(searchLower)
        );

        return keyMatch || diffMatch;
      });
    }

    return results;
  }, [comparisonResults, filterMode, searchTerm]);

  const stats = useMemo(() => {
    if (!comparisonResults.length) return null;

    const matches = comparisonResults.filter(r => r.status === 'match').length;
    const different = comparisonResults.filter(r => r.status === 'different').length;
    const onlyFile1 = comparisonResults.filter(r => r.status === 'onlyInFile1').length;
    const onlyFile2 = comparisonResults.filter(r => r.status === 'onlyInFile2').length;

    return {
      total: comparisonResults.length,
      matches,
      different,
      onlyFile1,
      onlyFile2
    };
  }, [comparisonResults]);

  const exportResults = useCallback(() => {
    let csvContent = 'Status,File1 Row,File2 Row,';

    if (keyColumns.length > 0) {
      csvContent += keyColumns.map(k => `Key: ${k}`).join(',') + ',';
    }

    csvContent += 'Column,File 1 Value,File 2 Value\n';

    filteredResults.forEach(result => {
      const keyVals = keyColumns.map(k => `"${String(result.keyValues[k] ?? '').replace(/"/g, '""')}"`).join(',');
      const keyValsPart = keyColumns.length > 0 ? keyVals + ',' : '';

      if (result.differences.length === 0) {
        const status = result.status === 'match' ? 'Match' :
          result.status === 'onlyInFile1' ? 'Only in File 1' : 'Only in File 2';
        csvContent += `${status},${result.file1Index !== null ? result.file1Index + 1 : ''},${result.file2Index !== null ? result.file2Index + 1 : ''},${keyValsPart}-,-,-\n`;
      } else {
        result.differences.forEach((diff, idx) => {
          const val1Escaped = String(diff.val1).replace(/"/g, '""');
          const val2Escaped = String(diff.val2).replace(/"/g, '""');
          if (idx === 0) {
            csvContent += `Different,${result.file1Index! + 1},${result.file2Index! + 1},${keyValsPart}${diff.column},"${val1Escaped}","${val2Escaped}"\n`;
          } else {
            csvContent += `,,,${keyColumns.length > 0 ? ','.repeat(keyColumns.length) : ''}${diff.column},"${val1Escaped}","${val2Escaped}"\n`;
          }
        });
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comparison-results.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, [filteredResults, keyColumns]);

  const loadMore = useCallback(() => {
    setDisplayLimit(prev => prev + 100);
  }, []);

  const displayedResults = useMemo(() => {
    return filteredResults.slice(0, displayLimit);
  }, [filteredResults, displayLimit]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
              <FileText className="text-indigo-600 w-6 h-6 sm:w-8 sm:h-8" />
              <span className="leading-tight">CSV Comparator Pro</span>
            </h1>
            <div className="text-xs bg-green-100 text-green-800 px-2 sm:px-3 py-1 rounded-full font-medium whitespace-nowrap">
              ⚡ Web Worker
            </div>
          </div>
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">Upload dan bandingkan file CSV dengan performa optimal</p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="text-red-600" />
                <span className="text-red-700 text-sm font-medium">{error}</span>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <Loader className="animate-spin text-blue-600" />
                <span className="text-blue-700 text-sm font-medium">
                  {processingProgress > 0 ? 'Processing comparison...' : 'Loading data...'}
                </span>
              </div>
              {processingProgress > 0 && (
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6 hover:border-indigo-500 transition">
              <label className="cursor-pointer flex flex-col items-center">
                <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mb-2" />
                <span className="text-xs sm:text-sm font-medium text-gray-700 mb-2 text-center">
                  {file1Name || 'Upload File 1 (CSV)'}
                </span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) parseCSV(file, setFile1Data, setFile1Name);
                  }}
                  className="hidden"
                  disabled={isProcessing}
                />
                {file1Data && (
                  <div className="text-xs text-green-600 mt-2">
                    ✓ {file1Data.length.toLocaleString()} rows loaded
                  </div>
                )}
              </label>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 sm:p-6 hover:border-indigo-500 transition">
              <label className="cursor-pointer flex flex-col items-center">
                <Upload className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mb-2" />
                <span className="text-xs sm:text-sm font-medium text-gray-700 mb-2 text-center">
                  {file2Name || 'Upload File 2 (CSV)'}
                </span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) parseCSV(file, setFile2Data, setFile2Name);
                  }}
                  className="hidden"
                  disabled={isProcessing}
                />
                {file2Data && (
                  <div className="text-xs text-green-600 mt-2">
                    ✓ {file2Data.length.toLocaleString()} rows loaded
                  </div>
                )}
              </label>
            </div>
          </div>

          {file1Data && file2Data && (
            <>
              <div className="bg-indigo-50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <Settings className="text-indigo-600" />
                  <h3 className="font-semibold text-gray-800">Mode Perbandingan</h3>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="rowByRow"
                      checked={matchingMode === 'rowByRow'}
                      onChange={(e) => setMatchingMode(e.target.value as 'rowByRow')}
                      disabled={isProcessing}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm text-gray-700">Row by Row</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      value="keyBased"
                      checked={matchingMode === 'keyBased'}
                      onChange={(e) => setMatchingMode(e.target.value as 'keyBased')}
                      disabled={isProcessing}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm text-gray-700">Parameter-Based</span>
                  </label>
                </div>
              </div>

              {matchingMode === 'keyBased' && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-3">
                    <div className="flex items-center gap-2">
                      <Key className="text-yellow-600 w-4 h-4 sm:w-5 sm:h-5" />
                      <h3 className="font-semibold text-sm sm:text-base text-gray-800">Pilih Parameter Matching</h3>
                      <span className="text-xs text-gray-600">({keyColumns.length} dipilih)</span>
                    </div>
                    <button
                      onClick={() => setShowKeySelection(!showKeySelection)}
                      className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-800 self-start sm:self-auto"
                      disabled={isProcessing}
                    >
                      {showKeySelection ? 'Sembunyikan' : 'Tampilkan'}
                    </button>
                  </div>

                  {keyColumns.length === 0 && (
                    <div className="text-sm text-yellow-700 mb-2">
                      ⚠️ Pilih minimal 1 kolom sebagai parameter untuk matching
                    </div>
                  )}

                  {showKeySelection && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {commonHeaders.map(header => (
                        <button
                          key={header}
                          onClick={() => toggleKeyColumn(header)}
                          disabled={isProcessing}
                          className={`px-3 py-1 rounded-full text-sm font-medium transition ${keyColumns.includes(header)
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white text-gray-700 border border-gray-300 hover:border-indigo-400'
                            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {header}
                        </button>
                      ))}
                    </div>
                  )}

                  {keyColumns.length > 0 && !showKeySelection && (
                    <div className="text-sm text-gray-700">
                      <strong>Parameter:</strong> {keyColumns.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {stats && (
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                  <h3 className="font-semibold text-sm sm:text-base text-gray-800 mb-3 sm:mb-4">Statistik Perbandingan</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
                    <div className="bg-white rounded p-2 sm:p-3 text-center">
                      <div className="text-lg sm:text-2xl font-bold text-gray-600">{stats.total.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">Total</div>
                    </div>
                    <div className="bg-white rounded p-2 sm:p-3 text-center">
                      <div className="text-lg sm:text-2xl font-bold text-green-600">{stats.matches.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">Matches</div>
                    </div>
                    <div className="bg-white rounded p-2 sm:p-3 text-center">
                      <div className="text-lg sm:text-2xl font-bold text-red-600">{stats.different.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">Different</div>
                    </div>
                    <div className="bg-white rounded p-2 sm:p-3 text-center">
                      <div className="text-lg sm:text-2xl font-bold text-orange-600">{stats.onlyFile1.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">Only File 1</div>
                    </div>
                    <div className="bg-white rounded p-2 sm:p-3 text-center">
                      <div className="text-lg sm:text-2xl font-bold text-purple-600">{stats.onlyFile2.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">Only File 2</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 items-stretch sm:items-center mb-4 sm:mb-6">
                <div className="flex-1 min-w-full sm:min-w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                    <input
                      type="text"
                      placeholder="Search in results..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 sm:pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <select
                  value={filterMode}
                  onChange={(e) => {
                    setFilterMode(e.target.value as typeof filterMode);
                    setDisplayLimit(100);
                  }}
                  className="px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">Show All</option>
                  <option value="match">Only Matches</option>
                  <option value="different">Only Different</option>
                  <option value="differences">All Differences</option>
                  <option value="onlyFile1">Only in File 1</option>
                  <option value="onlyFile2">Only in File 2</option>
                </select>

                <button
                  onClick={exportResults}
                  disabled={isProcessing || filteredResults.length === 0}
                  className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span> ({filteredResults.length.toLocaleString()})
                </button>
              </div>
            </>
          )}
        </div>

        {file1Data && file2Data && displayedResults.length > 0 && !isProcessing && (
          <div className="bg-white rounded-lg shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">File 1</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">File 2</th>
                    {keyColumns.length > 0 && (
                      <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase bg-yellow-50">Keys</th>
                    )}
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Column</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Value 1</th>
                    <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase">Value 2</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {displayedResults.map((result, idx) => {
                    const rowSpan = Math.max(result.differences.length, 1);
                    const bgColor =
                      result.status === 'match' ? 'bg-green-50' :
                        result.status === 'different' ? 'bg-red-50' :
                          result.status === 'onlyInFile1' ? 'bg-orange-50' : 'bg-purple-50';

                    if (result.differences.length === 0) {
                      return (
                        <tr key={idx} className={bgColor}>
                          <td className="px-2 sm:px-4 py-1 sm:py-2">
                            <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium whitespace-nowrap ${result.status === 'match' ? 'bg-green-200 text-green-800' :
                                result.status === 'onlyInFile1' ? 'bg-orange-200 text-orange-800' :
                                  'bg-purple-200 text-purple-800'
                              }`}>
                              {result.status === 'match' ? 'Match' :
                                result.status === 'onlyInFile1' ? 'File 1' : 'File 2'}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-1 sm:py-2">{result.file1Index !== null ? result.file1Index + 1 : '-'}</td>
                          <td className="px-2 sm:px-4 py-1 sm:py-2">{result.file2Index !== null ? result.file2Index + 1 : '-'}</td>
                          {keyColumns.length > 0 && (
                            <td className="px-2 sm:px-4 py-1 sm:py-2 bg-yellow-50 font-medium">
                              {Object.entries(result.keyValues).map(([k, v]) => (
                                <div key={k} className="text-xs truncate max-w-xs">{k}: {String(v)}</div>
                              ))}
                            </td>
                          )}
                          <td className="px-2 sm:px-4 py-1 sm:py-2 text-gray-500" colSpan={3}>No differences</td>
                        </tr>
                      );
                    }

                    return result.differences.map((diff, diffIdx) => (
                      <tr key={`${idx}-${diffIdx}`} className={bgColor}>
                        {diffIdx === 0 && (
                          <>
                            <td rowSpan={rowSpan} className="px-2 sm:px-4 py-1 sm:py-2 border-r">
                              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-red-200 text-red-800 rounded text-xs font-medium whitespace-nowrap">
                                Diff
                              </span>
                            </td>
                            <td rowSpan={rowSpan} className="px-2 sm:px-4 py-1 sm:py-2 border-r">{result.file1Index! + 1}</td>
                            <td rowSpan={rowSpan} className="px-2 sm:px-4 py-1 sm:py-2 border-r">{result.file2Index! + 1}</td>
                            {keyColumns.length > 0 && (
                              <td rowSpan={rowSpan} className="px-2 sm:px-4 py-1 sm:py-2 bg-yellow-50 font-medium border-r">
                                {Object.entries(result.keyValues).map(([k, v]) => (
                                  <div key={k} className="text-xs truncate max-w-xs">{k}: {String(v)}</div>
                                ))}
                              </td>
                            )}
                          </>
                        )}
                        <td className="px-2 sm:px-4 py-1 sm:py-2 font-medium truncate max-w-xs">{diff.column}</td>
                        <td className={`px-2 sm:px-4 py-1 sm:py-2 truncate max-w-xs ${diff.onlyInFile1 ? 'bg-yellow-100' : ''}`}>
                          {String(diff.val1)}
                        </td>
                        <td className={`px-2 sm:px-4 py-1 sm:py-2 truncate max-w-xs ${diff.onlyInFile2 ? 'bg-yellow-100' : ''}`}>
                          {String(diff.val2)}
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 px-3 sm:px-4 py-3 sm:py-4 border-t">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-xs sm:text-sm text-gray-600">
                  Showing <strong>{displayedResults.length.toLocaleString()}</strong> of <strong>{filteredResults.length.toLocaleString()}</strong>
                  {filteredResults.length !== comparisonResults.length && (
                    <span className="block sm:inline sm:ml-2 text-gray-500">
                      (filtered from {comparisonResults.length.toLocaleString()})
                    </span>
                  )}
                </div>
                {displayedResults.length < filteredResults.length && (
                  <button
                    onClick={loadMore}
                    className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm"
                  >
                    Load More (100)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {file1Data && file2Data && filteredResults.length === 0 && !isProcessing && (
          <div className="bg-white rounded-lg shadow-xl p-8 sm:p-12 text-center">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <p className="text-sm sm:text-base text-gray-600">Tidak ada hasil yang sesuai dengan filter</p>
          </div>
        )}

        {!file1Data && !file2Data && (
          <div className="bg-white rounded-lg shadow-xl p-8 sm:p-12 text-center">
            <AlertCircle className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <p className="text-sm sm:text-base text-gray-600">Upload kedua file CSV untuk memulai perbandingan</p>
          </div>
        )}
      </div>
    </div>
  );
}