import { useState, useEffect, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Search, Check, Trash2, Loader2, ImageIcon } from 'lucide-react'
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

interface MediaPickerProps {
  value: string
  onChange: (url: string) => void
  label?: string
}

export function MediaPicker({ value, onChange, label = 'Image' }: MediaPickerProps) {
  const [open, setOpen] = useState(false)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string>(value)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchMedia = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await apiClient.get('/media', { params: { page_size: 50, search } })
      setMedia(res.data.data?.data || [])
    } catch { /* ignore */ }
    finally { setIsLoading(false) }
  }, [search])

  useEffect(() => {
    if (open) {
      fetchMedia()
      setSelected(value)
    }
  }, [open, fetchMedia, value])

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
      alert('Failed to upload file')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSelect = () => {
    onChange(selected)
    setOpen(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this media file?')) return
    try {
      await apiClient.delete(`/media/${id}`)
      if (selected === media.find(m => m.id === id)?.url) {
        setSelected('')
      }
      fetchMedia()
    } catch { alert('Failed to delete') }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        {value ? (
          <div className="relative group w-20 h-20 rounded-md border overflow-hidden bg-muted">
            <img src={getMediaUrl(value)} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white" onClick={() => setOpen(true)}>
                <ImageIcon size={14} />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-white" onClick={() => onChange('')}>
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setOpen(true)} className="h-20 w-20 flex-col gap-1">
            <ImageIcon size={20} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Media Library</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 mt-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search media..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Upload size={16} className="mr-2" />}
              Upload
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto mt-3 min-h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : media.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ImageIcon size={48} className="mb-2 opacity-50" />
                <p>No media files yet. Upload some!</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                {media.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'group relative aspect-square rounded-md border-2 overflow-hidden cursor-pointer transition-all',
                      selected === item.url ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-muted-foreground/30'
                    )}
                    onClick={() => setSelected(item.url)}
                  >
                    {item.mime_type.startsWith('image/') ? (
                      <img src={getMediaUrl(item.url)} alt={item.alt || item.original_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted">
                        <span className="text-xs text-muted-foreground">{item.mime_type.split('/')[1]?.toUpperCase()}</span>
                      </div>
                    )}
                    {selected === item.url && (
                      <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                        <Check size={12} className="text-primary-foreground" />
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                      className="absolute bottom-1 right-1 bg-destructive/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={10} className="text-white" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[9px] text-white truncate">{item.original_name}</p>
                      <p className="text-[8px] text-white/70">{formatSize(item.size)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleSelect} disabled={!selected}>
              Select
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
