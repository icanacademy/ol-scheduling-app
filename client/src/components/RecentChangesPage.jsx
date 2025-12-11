import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getRecentChanges } from '../services/api';

function RecentChangesPage() {
  const [limit, setLimit] = useState(50);
  const [groupByStudent, setGroupByStudent] = useState(false);

  // Fetch recent changes
  const { data: recentChanges, isLoading, error } = useQuery({
    queryKey: ['recentChanges', limit],
    queryFn: async () => {
      const response = await getRecentChanges(limit);
      return response.data; // Extract data from axios response
    }
  });

  const formatChangeType = (type) => {
    const typeMap = {
      'teacher_change': 'Teacher Change',
      'time_change': 'Time Change',
      'day_change': 'Day Change',
      'subject_change': 'Subject Change',
      'teacher_and_time_change': 'Teacher & Time Change',
      'other': 'Other'
    };
    return typeMap[type] || type;
  };

  const getChangeTypeColor = (type) => {
    const colorMap = {
      'teacher_change': 'bg-blue-100 text-blue-800',
      'time_change': 'bg-green-100 text-green-800',
      'day_change': 'bg-purple-100 text-purple-800',
      'subject_change': 'bg-yellow-100 text-yellow-800',
      'teacher_and_time_change': 'bg-orange-100 text-orange-800',
      'other': 'bg-gray-100 text-gray-800'
    };
    return colorMap[type] || 'bg-gray-100 text-gray-800';
  };

  // Group changes by student if requested
  const groupedChanges = groupByStudent && recentChanges
    ? recentChanges.reduce((acc, change) => {
        const key = `${change.student_id}-${change.student_name}`;
        if (!acc[key]) {
          acc[key] = {
            studentId: change.student_id,
            studentName: change.student_name,
            studentEnglishName: change.student_english_name,
            changes: []
          };
        }
        acc[key].changes.push(change);
        return acc;
      }, {})
    : null;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Recent Student Changes</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={groupByStudent}
                onChange={(e) => setGroupByStudent(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Group by Student</span>
            </label>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={25}>Last 25 Changes</option>
              <option value={50}>Last 50 Changes</option>
              <option value={100}>Last 100 Changes</option>
              <option value={200}>Last 200 Changes</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading recent changes...</div>
        ) : !recentChanges || recentChanges.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No recent changes found</div>
        ) : (
          <div className="space-y-4">
            {groupByStudent ? (
              // Grouped view
              Object.values(groupedChanges).map((group) => (
                <div key={group.studentId} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3">
                    {group.studentName}
                    {group.studentEnglishName && (
                      <span className="text-gray-600 ml-2">({group.studentEnglishName})</span>
                    )}
                  </h3>
                  <div className="space-y-2 ml-4">
                    {group.changes.map((change) => (
                      <div key={change.id} className="border-l-2 border-gray-200 pl-4 py-2">
                        <div className="flex items-center gap-3 mb-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getChangeTypeColor(change.change_type)}`}>
                            {formatChangeType(change.change_type)}
                          </span>
                          <div className="text-sm text-gray-600">
                            <div>Decision: {new Date(change.change_date).toLocaleDateString()}</div>
                            {change.implementation_date && change.implementation_date !== change.change_date && (
                              <div>Implemented: {new Date(change.implementation_date).toLocaleDateString()}</div>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(change.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-900">{change.change_description}</p>
                        {change.reason && (
                          <p className="text-xs text-gray-600 mt-1">
                            Reason: {change.reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              // Chronological view
              recentChanges.map((change) => (
                <div
                  key={change.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-gray-900">
                          {change.student_name}
                          {change.student_english_name && (
                            <span className="text-gray-600 ml-1">({change.student_english_name})</span>
                          )}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getChangeTypeColor(change.change_type)}`}>
                          {formatChangeType(change.change_type)}
                        </span>
                        <span className="text-sm text-gray-600">
                          {new Date(change.change_date).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900 mb-1">
                        {change.change_description}
                      </p>
                      {change.reason && (
                        <p className="text-sm text-gray-600 mb-1">
                          <strong>Reason:</strong> {change.reason}
                        </p>
                      )}
                      {change.notes && (
                        <p className="text-sm text-gray-500">
                          <strong>Notes:</strong> {change.notes}
                        </p>
                      )}
                      
                      {/* Show detailed change info if available */}
                      {(change.old_teacher_names?.length > 0 || change.new_teacher_names?.length > 0) && (
                        <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-2">
                          {change.old_teacher_names?.length > 0 && (
                            <div>From: {change.old_teacher_names.join(', ')}</div>
                          )}
                          {change.new_teacher_names?.length > 0 && (
                            <div>To: {change.new_teacher_names.join(', ')}</div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 ml-4 text-right">
                      <div>Recorded:</div>
                      <div>{new Date(change.created_at).toLocaleString()}</div>
                      {change.recorded_by !== 'system' && (
                        <div>by {change.recorded_by}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RecentChangesPage;