import { NotificationBell } from './NotificationBell';

<div className="flex items-center gap-4">
  {/* ... existing code ... */}
  
  {user && <NotificationBell />}
  
  <UserAccountNav />
</div> 