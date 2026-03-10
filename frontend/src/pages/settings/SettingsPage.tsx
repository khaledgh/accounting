import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings, Building2, Users, Globe, Shield, FileText, ImageIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const settingsItems = [
  { title: 'Companies', description: 'Manage companies and branches', icon: Building2, path: '/settings/companies' },
  { title: 'Users', description: 'Manage users and roles', icon: Users, path: '/settings/users' },
  { title: 'Currencies', description: 'Manage currencies and exchange rates', icon: Globe, path: '/accounting/currencies' },
  { title: 'Roles & Permissions', description: 'Configure access control', icon: Shield, path: '/settings/roles' },
  { title: 'Invoice Templates', description: 'Create and manage invoice templates', icon: FileText, path: '/settings/invoice-templates' },
  { title: 'Media Center', description: 'Upload and manage images and files', icon: ImageIcon, path: '/settings/media' },
]

export function SettingsPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure your system preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {settingsItems.map((item) => (
          <Card
            key={item.title}
            className="cursor-pointer transition-colors hover:bg-muted/50"
            onClick={() => navigate(item.path)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <item.icon size={18} className="text-primary" />
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
