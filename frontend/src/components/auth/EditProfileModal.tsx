import { useState, useEffect } from 'react'
import { updateProfile } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { UserProfile } from '@/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: UserProfile | null
  onUpdated: (profile: UserProfile) => void
}

export function EditProfileModal({ open, onOpenChange, profile, onUpdated }: Props) {
  const [displayName, setDisplayName] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [success,     setSuccess]     = useState(false)

  useEffect(() => {
    if (open) {
      setDisplayName(profile?.display_name ?? '')
      setError(null)
      setSuccess(false)
    }
  }, [open, profile])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const updated = await updateProfile(displayName.trim() || null)
      onUpdated(updated)
      setSuccess(true)
      setTimeout(() => onOpenChange(false), 1400)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Update your display name. Your email address cannot be changed.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="px-6 py-8 flex flex-col items-center gap-3 text-center">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <p className="text-sm font-medium">Profile updated!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 flex flex-col gap-4">

              {/* Email (read-only) */}
              <div className="space-y-1.5">
                <Label className="text-muted-foreground">Email address</Label>
                <Input value={profile?.email ?? ''} readOnly disabled className="opacity-60 cursor-not-allowed" />
              </div>

              {/* Display name */}
              <div className="space-y-1.5">
                <Label htmlFor="ep-name">Display name</Label>
                <Input
                  id="ep-name" type="text" value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  maxLength={80}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Shown in the sidebar. Leave empty to use your email prefix.
                </p>
              </div>

              {/* Account info */}
              {profile && (
                <div className="rounded-lg bg-muted/40 border px-3 py-2.5 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Member since{' '}
                    <span className="text-foreground font-medium">
                      {new Date(profile.created_at).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    Account status:{' '}
                    <span className={profile.is_active ? 'text-emerald-500 font-medium' : 'text-red-500 font-medium'}>
                      {profile.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg px-3 py-2.5 text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</> : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
