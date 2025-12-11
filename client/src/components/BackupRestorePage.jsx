import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBackups, createBackup, syncBackups, previewBackup, restoreBackup, downloadBackup, deleteBackup } from '../services/api';

export default function BackupRestorePage() {
  const queryClient = useQueryClient();
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Fetch backups
  const { data: backups, isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: async () => {
      const response = await getBackups();
      return response.data;
    }
  });

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const description = prompt('Enter backup description (optional):');
      const response = await createBackup(description);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['backups']);
      alert('Backup created successfully!');
    },
    onError: (error) => {
      alert(`Failed to create backup: ${error.response?.data?.message || error.message}`);
    }
  });

  // Sync backups mutation
  const syncBackupsMutation = useMutation({
    mutationFn: async () => {
      const response = await syncBackups();
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['backups']);
      const { added, removed } = data.result;
      let message = 'Sync completed:\n';
      if (added > 0) message += `✓ Added ${added} new backup file(s)\n`;
      if (removed > 0) message += `✓ Removed ${removed} orphaned record(s)\n`;
      if (added === 0 && removed === 0) message += 'Everything is already in sync!';
      alert(message);
    },
    onError: (error) => {
      alert(`Failed to sync backups: ${error.response?.data?.message || error.message}`);
    }
  });

  // Preview backup mutation
  const previewMutation = useMutation({
    mutationFn: async (filename) => {
      const response = await previewBackup(filename);
      return response.data;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setShowPreview(true);
    },
    onError: (error) => {
      alert(`Failed to preview backup: ${error.response?.data?.message || error.message}`);
    }
  });

  // Restore backup mutation
  const restoreMutation = useMutation({
    mutationFn: async ({ filename, options }) => {
      const response = await restoreBackup(filename, options);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowRestoreModal(false);
      setSelectedBackup(null);
      alert('Backup restored successfully! Page will reload.');
      window.location.reload();
    },
    onError: (error) => {
      alert(`Failed to restore backup: ${error.response?.data?.message || error.message}`);
    }
  });

  // Download backup mutation
  const downloadMutation = useMutation({
    mutationFn: async (filename) => {
      const response = await downloadBackup(filename);
      return { data: response.data, filename };
    },
    onSuccess: ({ data, filename }) => {
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    },
    onError: (error) => {
      alert(`Failed to download backup: ${error.message}`);
    }
  });

  // Delete backup mutation
  const deleteMutation = useMutation({
    mutationFn: async (filename) => {
      const response = await deleteBackup(filename);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['backups']);
      alert('Backup deleted successfully!');
    },
    onError: (error) => {
      alert(`Failed to delete backup: ${error.response?.data?.message || error.message}`);
    }
  });

  const handlePreview = (backup) => {
    setSelectedBackup(backup);
    previewMutation.mutate(backup.filename);
  };

  const handleRestore = (backup) => {
    setSelectedBackup(backup);
    setShowRestoreModal(true);
  };

  const confirmRestore = () => {
    if (!selectedBackup) return;

    const confirmed = confirm(
      `⚠️ WARNING: Restore from backup?\n\nThis will restore:\n• ${selectedBackup.teachers_count || 0} teachers\n• ${selectedBackup.students_count || 0} students\n• ${selectedBackup.assignments_count || 0} assignments\n\nCurrent data will be replaced!\n\nProceed?`
    );

    if (confirmed) {
      restoreMutation.mutate({
        filename: selectedBackup.filename,
        options: {}
      });
    }
  };

  const handleDownload = (backup) => {
    downloadMutation.mutate(backup.filename);
  };

  const handleDelete = (backup) => {
    const confirmed = confirm(`Delete backup "${backup.filename}"?\n\nThis action cannot be undone.`);
    if (confirmed) {
      deleteMutation.mutate(backup.filename);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  if (isLoading) {
    return <div className="p-8">Loading backups...</div>;
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Backup & Restore</h1>
          <p className="text-gray-600">Manage your database backups and restore data safely</p>
        </div>

        {/* Create Backup Button */}
        <div className="mb-6">
          <div className="flex gap-3 mb-2">
            <button
              onClick={() => createBackupMutation.mutate()}
              disabled={createBackupMutation.isPending}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
            >
              {createBackupMutation.isPending ? 'Creating Backup...' : '📦 Create Backup Now'}
            </button>
            <button
              onClick={() => syncBackupsMutation.mutate()}
              disabled={syncBackupsMutation.isPending}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-semibold"
            >
              {syncBackupsMutation.isPending ? 'Syncing...' : '🔄 Sync Backup Files'}
            </button>
          </div>
          <p className="text-sm text-gray-600">
            💡 Backups are automatically created before all "Delete All" operations. Click "Sync" to register backup files from disk.
          </p>
        </div>

        {/* Backups List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-xl font-semibold">Available Backups ({backups?.length || 0})</h2>
          </div>

          {!backups || backups.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No backups found. Create your first backup above.
            </div>
          ) : (
            <div className="divide-y">
              {backups.map((backup) => (
                <div key={backup.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">📦</span>
                        <div>
                          <h3 className="font-semibold text-lg">{formatDate(backup.created_at)}</h3>
                          <p className="text-sm text-gray-600">{backup.filename}</p>
                        </div>
                      </div>

                      <div className="ml-11 space-y-1">
                        <div className="flex gap-6 text-sm">
                          <span className="text-gray-700">
                            👥 {backup.teachers_count} teacher{backup.teachers_count !== 1 ? 's' : ''}
                          </span>
                          <span className="text-gray-700">
                            🎓 {backup.students_count} student{backup.students_count !== 1 ? 's' : ''}
                          </span>
                          <span className="text-gray-700">
                            📅 {backup.assignments_count} assignment{backup.assignments_count !== 1 ? 's' : ''}
                          </span>
                          <span className="text-gray-700">
                            💾 {formatFileSize(backup.file_size_bytes)}
                          </span>
                        </div>

                        {backup.description && (
                          <p className="text-sm text-gray-600 italic">"{backup.description}"</p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePreview(backup)}
                        disabled={previewMutation.isPending}
                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm font-medium"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => handleRestore(backup)}
                        disabled={restoreMutation.isPending}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => handleDownload(backup)}
                        disabled={downloadMutation.isPending}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => handleDelete(backup)}
                        disabled={deleteMutation.isPending}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview Modal */}
        {showPreview && previewData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
              <h2 className="text-2xl font-bold mb-4">Backup Preview</h2>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Filename</p>
                  <p className="font-semibold">{previewData.filename}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Created</p>
                  <p className="font-semibold">{formatDate(previewData.created_at)}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-600">Contents</p>
                  <div className="bg-gray-50 p-4 rounded space-y-2">
                    <p>👥 {previewData.teachers_count} Teachers</p>
                    <p>🎓 {previewData.students_count} Students</p>
                    <p>📅 {previewData.assignments_count} Assignments</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-gray-600">File Size</p>
                  <p className="font-semibold">{previewData.file_size_mb} MB</p>
                </div>

                {previewData.description && (
                  <div>
                    <p className="text-sm text-gray-600">Description</p>
                    <p className="font-semibold">{previewData.description}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowPreview(false);
                    handleRestore(selectedBackup);
                  }}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium"
                >
                  Restore This Backup
                </button>
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setPreviewData(null);
                    setSelectedBackup(null);
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Restore Confirmation Modal */}
        {showRestoreModal && selectedBackup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-lg w-full">
              <h2 className="text-2xl font-bold mb-4 text-red-600">⚠️ Confirm Restore</h2>

              <p className="mb-4">
                You are about to restore from backup created on:
              </p>
              <p className="font-bold text-lg mb-4">{formatDate(selectedBackup.created_at)}</p>

              <div className="bg-yellow-50 border border-yellow-300 rounded p-4 mb-4">
                <p className="font-semibold mb-2">Warning:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>All current data will be replaced</li>
                  <li>This action cannot be undone</li>
                  <li>The page will reload after restore</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={confirmRestore}
                  disabled={restoreMutation.isPending}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium disabled:bg-gray-400"
                >
                  {restoreMutation.isPending ? 'Restoring...' : 'Yes, Restore Backup'}
                </button>
                <button
                  onClick={() => {
                    setShowRestoreModal(false);
                    setSelectedBackup(null);
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
