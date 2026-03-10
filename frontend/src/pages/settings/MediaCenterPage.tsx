import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Upload, Search, Trash2, Loader2, ImageIcon, Pencil, CheckSquare, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import apiClient from '@/api/client'
import { getMediaUrl } from '@/lib/media'

interface MediaItem {
  id: string
  filename: string
  original_name: string
  mime_type: string
  size: number
  url: string
  alt: string
  created_at: string
}

export function MediaCenterPage() {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editItem, setEditItem] = useState<MediaItem | null>(null)
  const [editAlt, setEditAlt] = useState('')
  const [total, setTotal] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchMedia = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/media', { params: { page_size: 100, search } })
      setMedia(res.data.data?.data || [])
      setTotal(res.data.data?.total || 0)
    } catch { /* ignore */ }
    finally { setIsLoading(false) }
  }, [search])

  useEffect(() => {
    fetchMedia()
  }, [fetchMedia])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        await apiClient.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      fetchMedia()
    } catch {
      alert('Failed to upload files')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const files = e.dataTransfer.files
    if (!files.length) return

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        await apiClient.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }
      fetchMedia()
    } catch {
      alert('Failed to upload files')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this media file?')) return
    try {
      await apiClient.delete(`/media/${id}`)
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n })
      fetchMedia()
    } catch { alert('Failed to delete') }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} selected files?`)) return
    try {
      await apiClient.post('/media/bulk-delete', { ids: Array.from(selectedIds) })
      setSelectedIds(new Set())
      fetchMedia()
    } catch { alert('Failed to delete files') }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleEditSave = async () => {
    if (!editItem) return
    try {
      await apiClient.put(`/media/${editItem.id}`, { alt: editAlt })
      setEditItem(null)
      fetchMedia()
    } catch { alert('Failed to update') }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Media Center</h1>
          <p className="text-muted-foreground">{total} file{total !== 1 ? 's' : ''} uploaded</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 size={14} className="mr-1" />
              Delete ({selectedIds.size})
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Upload size={16} className="mr-2" />}
            Upload Files
          </Button>
        </div>
      </div>

      <div
        className="border-2 border-dashed rounded-lg p-8 text-center transition-colors hover:border-primary/50"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Uploading...</span>
          </div>
        ) : (
          <div className="text-muted-foreground">
            <Upload size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">Drag & drop files here, or click Upload</p>
            <p className="text-xs mt-1">Accepted: JPEG, PNG, GIF, WebP, SVG, BMP, PDF (max 10MB)</p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or alt text..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {selectedIds.size > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            <X size={14} className="mr-1" /> Clear selection
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ImageIcon size={16} />
            <span>Media Files</span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : media.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon size={48} className="mx-auto mb-2 opacity-50" />
              <p>No media files yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {media.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'group relative aspect-square rounded-lg border-2 overflow-hidden cursor-pointer transition-all',
                    selectedIds.has(item.id) ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-muted-foreground/40'
                  )}
                >
                  {item.mime_type.startsWith('image/') ? (
                    <img src={getMediaUrl(item.url)} alt={item.alt || item.original_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <span className="text-sm font-mono text-muted-foreground">{item.mime_type.split('/')[1]?.toUpperCase()}</span>
                    </div>
                  )}

                  {/* Selection checkbox */}
                  <button
                    onClick={() => toggleSelect(item.id)}
                    className="absolute top-1.5 left-1.5 z-10"
                  >
                    {selectedIds.has(item.id) ? (
                      <CheckSquare size={18} className="text-primary drop-shadow" />
                    ) : (
                      <Square size={18} className="text-white/70 drop-shadow opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>

                  {/* Action buttons */}
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setEditItem(item); setEditAlt(item.alt) }}
                      className="bg-background/80 rounded p-1 hover:bg-background"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="bg-destructive/80 rounded p-1 hover:bg-destructive"
                    >
                      <Trash2 size={12} className="text-white" />
                    </button>
                  </div>

                  {/* Info overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/70 to-transparent p-2 pt-6">
                    <p className="text-xs text-white truncate">{item.original_name}</p>
                    <p className="text-[10px] text-white/70">{formatSize(item.size)} · {formatDate(item.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Alt Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Media</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4 mt-4">
              {editItem.mime_type.startsWith('image/') && (
                <img src={getMediaUrl(editItem.url)} alt="" className="w-full max-h-48 object-contain rounded border" />
              )}
              <div className="text-sm text-muted-foreground">
                <p><strong>File:</strong> {editItem.original_name}</p>
                <p><strong>Size:</strong> {formatSize(editItem.size)}</p>
                <p><strong>URL:</strong> <code className="text-xs bg-muted px-1 py-0.5 rounded">{editItem.url}</code></p>
              </div>
              <div className="space-y-2">
                <Label>Alt Text</Label>
                <Input value={editAlt} onChange={(e) => setEditAlt(e.target.value)} placeholder="Describe this image..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button onClick={handleEditSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
