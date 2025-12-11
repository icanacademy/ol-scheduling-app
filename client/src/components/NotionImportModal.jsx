import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { weekDays } from '../utils/dayMapping';

function NotionImportModal({ isOpen, onClose, type, selectedDate, onPreview, onImport }) {
  const [previewData, setPreviewData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedDays, setSelectedDays] = useState({}); // Track selected days per student

  const queryClient = useQueryClient();

  const handlePreview = async () => {
    if (!selectedDate) {
      alert('Please select a date first');
      return;
    }

    setIsLoading(true);
    try {
      const data = await onPreview(selectedDate);
      setPreviewData(data);
      setSelectedItems(data.map((_, index) => index)); // Select all by default
      
      // Initialize all days selected for all students by default
      const initialDays = {};
      data.forEach((_, index) => {
        initialDays[index] = [...weekDays];
      });
      setSelectedDays(initialDays);
    } catch (error) {
      console.error('Preview error:', error);
      alert(`Failed to preview ${type}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (selectedItems.length === 0) {
      alert(`Please select at least one ${type.slice(0, -1)} to import`);
      return;
    }
    
    // Check if all selected students have at least one day selected (only for students)
    if (type === 'students') {
      const studentsWithoutDays = selectedItems.filter(index => 
        !selectedDays[index] || selectedDays[index].length === 0
      );
      
      if (studentsWithoutDays.length > 0) {
        alert(`Please select at least one day for all selected students.`);
        return;
      }
    }

    const itemsToImport = selectedItems.map(index => {
      const item = { ...previewData[index] };
      
      // Only add selectedDays for students, not teachers
      if (type === 'students') {
        item.selectedDays = selectedDays[index] || [];
      }
      
      return item;
    });
    
    setIsLoading(true);
    try {
      await onImport(itemsToImport);
      // Invalidate queries for all days since we might have imported to multiple days
      queryClient.invalidateQueries([type]);
      
      if (type === 'students') {
        // Calculate total imports (students × days)
        const totalImports = itemsToImport.reduce((total, item) => 
          total + (item.selectedDays?.length || 0), 0
        );
        alert(`Successfully imported ${selectedItems.length} ${type} across ${totalImports} day assignments`);
      } else {
        alert(`Successfully imported ${selectedItems.length} ${type}`);
      }
      onClose();
    } catch (error) {
      console.error('Import error:', error);
      alert(`Failed to import ${type}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItemSelection = (index) => {
    setSelectedItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const selectAll = () => {
    setSelectedItems(previewData.map((_, index) => index));
  };
  
  const toggleDayForStudent = (studentIndex, day) => {
    setSelectedDays(prev => {
      const current = prev[studentIndex] || [];
      const updated = current.includes(day)
        ? current.filter(d => d !== day)
        : [...current, day];
      return {
        ...prev,
        [studentIndex]: updated
      };
    });
  };
  
  const selectAllDaysForStudent = (studentIndex) => {
    setSelectedDays(prev => ({
      ...prev,
      [studentIndex]: [...weekDays]
    }));
  };
  
  const deselectAllDaysForStudent = (studentIndex) => {
    setSelectedDays(prev => ({
      ...prev,
      [studentIndex]: []
    }));
  };

  const deselectAll = () => {
    setSelectedItems([]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Import {type} from Notion</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            Selected Date: <span className="font-semibold">{selectedDate}</span>
          </p>
          
          {!previewData.length ? (
            <button
              onClick={handlePreview}
              disabled={isLoading}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded"
            >
              {isLoading ? 'Loading...' : `Preview ${type} from Notion`}
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
              >
                Deselect All
              </button>
              <span className="text-sm text-gray-600 flex items-center">
                Selected: {selectedItems.length} of {previewData.length}
              </span>
            </div>
          )}
        </div>

        {previewData.length > 0 && (
          <div className="flex-1 overflow-auto mb-4">
            <div className="grid gap-2 max-h-96">
              {previewData.map((item, index) => (
                <div
                  key={index}
                  className={`border rounded p-3 ${
                    selectedItems.includes(index)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Student selection and basic info */}
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(index)}
                        onChange={() => toggleItemSelection(index)}
                        className="mr-3 mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-semibold">{item.name}</div>
                        {item.englishName && (
                          <div className="text-sm text-gray-600">{item.englishName}</div>
                        )}
                        <div className="text-sm text-gray-500">
                          Availability: {item.availability?.join(', ') || 'None'}
                        </div>
                        {item.colorKeyword && (
                          <div className="text-sm">
                            <span className={`inline-block w-3 h-3 rounded mr-1 bg-${item.colorKeyword}-500`}></span>
                            {item.colorKeyword}
                          </div>
                        )}
                        {item.weaknessLevel !== undefined && (
                          <div className="text-sm text-red-600">
                            Weakness Level: {item.weaknessLevel}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Day selection for students only */}
                    {selectedItems.includes(index) && type === 'students' && (
                      <div className="ml-6 border-t pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Import on days:</span>
                          <div className="space-x-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectAllDaysForStudent(index);
                              }}
                              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                            >
                              All
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deselectAllDaysForStudent(index);
                              }}
                              className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            >
                              None
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {weekDays.map(day => {
                            const isSelected = selectedDays[index]?.includes(day) || false;
                            return (
                              <label
                                key={day}
                                className="flex items-center cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleDayForStudent(index, day)}
                                  className="sr-only"
                                />
                                <div className={`text-xs px-2 py-1 rounded text-center w-full transition-colors ${
                                  isSelected
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}>
                                  {day.substring(0, 3)}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Selected: {selectedDays[index]?.length || 0} days
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {previewData.length > 0 && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              onClick={onClose}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={isLoading || selectedItems.length === 0}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded"
            >
              {isLoading ? 'Importing...' : `Import Selected ${type}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default NotionImportModal;