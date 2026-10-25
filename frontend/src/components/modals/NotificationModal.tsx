import { useEffect, useRef, useState, type FC, type MouseEvent } from 'react';
import { notificationsApi, organizationApi, sitesApi } from '../../services/apiService';

type NotificationSeverity = 'critical' | 'warning' | 'success';
type NotificationKind = 'license' | 'site' | 'message';

interface NotificationItem {
  id: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  description: string;
  timestamp?: string | null;
  isRead?: boolean;
  canMarkRead?: boolean;
}

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCountChange: (count: number) => void;
}

interface SiteRecord {
  id: string | number;
  name: string;
  location?: string;
  status?: string;
  last_seen?: string | null;
}

interface ApiNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown> | null;
  created_at?: string | null;
  is_read?: boolean;
}

const getLicenseDeadline = (snapshotMonth?: string | null) => {
  const match = snapshotMonth?.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;

  return new Date(Number(match[1]), Number(match[2]), 5, 10);
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const getErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : 'An unexpected error occurred.'
);

const fetchAllSites = async (): Promise<SiteRecord[]> => {
  const firstPage = await sitesApi.getAll();
  const sites: SiteRecord[] = Array.isArray(firstPage?.data) ? firstPage.data : [];
  const lastPage = Number(firstPage?.meta?.last_page || 1);

  if (lastPage > 1) {
    const remainingPages = await Promise.all(
      Array.from({ length: lastPage - 1 }, (_, index) => sitesApi.getAll(index + 2))
    );
    remainingPages.forEach(page => {
      if (Array.isArray(page?.data)) sites.push(...page.data);
    });
  }

  return sites;
};

const NotificationModal: FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  onCountChange,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [markingReadId, setMarkingReadId] = useState<string | null>(null);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [markReadErrors, setMarkReadErrors] = useState<Record<string, string>>({});
  const [markAllReadError, setMarkAllReadError] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen && hasLoaded.current) return;

    let isCurrent = true;
    setIsLoading(true);
    setErrors([]);

    const loadNotifications = async () => {
      const [billingResult, sitesResult, notificationsResult] = await Promise.allSettled([
        organizationApi.getLicenseBilling(),
        fetchAllSites(),
        notificationsApi.getAll(),
      ]);

      if (!isCurrent) return;

      const nextNotifications: NotificationItem[] = [];
      const nextErrors: string[] = [];
      const persistedOfflineSiteIds = new Set<string>();

      if (notificationsResult.status === 'fulfilled') {
        const items: ApiNotification[] = Array.isArray(notificationsResult.value?.data)
          ? notificationsResult.value.data
          : [];
        items.forEach(notification => {
          const isSite = notification.type === 'site_status';
          const isOffline = isSite && notification.data?.status === 'offline';

          if (isOffline && notification.data?.site_id !== undefined) {
            persistedOfflineSiteIds.add(String(notification.data.site_id));
          }

          nextNotifications.push({
            id: notification.id,
            kind: isSite ? 'site' : 'message',
            severity: isOffline ? 'critical' : 'success',
            title: notification.title,
            description: notification.body,
            timestamp: notification.created_at,
            isRead: notification.is_read,
            canMarkRead: true,
          });
        });
      } else {
        nextErrors.push(`Notifications could not be loaded: ${getErrorMessage(notificationsResult.reason)}`);
      }

      if (sitesResult.status === 'fulfilled') {
        sitesResult.value
          .filter(site => (
            String(site.status).toLowerCase() === 'offline'
            && !persistedOfflineSiteIds.has(String(site.id))
          ))
          .forEach(site => {
            const details = [
              site.location,
              site.last_seen ? `Last seen ${formatDate(site.last_seen)}` : 'No successful connection has been recorded.',
            ].filter((detail): detail is string => Boolean(detail));

            nextNotifications.push({
              id: `site-offline-${site.id}`,
              kind: 'site',
              severity: 'critical',
              title: `${site.name} is offline`,
              description: details.join(' / '),
              timestamp: site.last_seen,
            });
          });
      } else {
        nextErrors.push(`Site status could not be loaded: ${getErrorMessage(sitesResult.reason)}`);
      }

      if (billingResult.status === 'fulfilled') {
        const billing = billingResult.value;
        const current = billing?.current;
        const organizationSuspended = billing?.organization_status === 'suspended';
        const isUnpaid = Boolean(current && String(current.status).toLowerCase() !== 'paid');
        const deadline = getLicenseDeadline(current?.snapshot_month);
        const licenseExpired = isUnpaid && deadline !== null && deadline.getTime() <= Date.now();

        if (organizationSuspended || licenseExpired) {
          nextNotifications.push({
            id: 'license-expired',
            kind: 'license',
            severity: 'critical',
            title: licenseExpired ? 'License expired' : 'Organization suspended',
            description: licenseExpired
              ? `The license billing for ${formatDate(current?.snapshot_month)} is still unpaid. Payment was due ${formatDate(deadline?.toISOString())}.`
              : 'The organization is currently suspended. Review the license billing status and resolve any outstanding payment.',
          });
        }
      } else {
        nextErrors.push(`License status could not be loaded: ${getErrorMessage(billingResult.reason)}`);
      }

      nextNotifications.sort((left, right) => {
        const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0;
        const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0;
        return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
      });

      setNotifications(nextNotifications);
      setErrors(nextErrors);
      setLastUpdated(new Date());
      onCountChange(nextNotifications.filter(notification => !notification.isRead).length);
      setIsLoading(false);
      hasLoaded.current = true;
    };

    void loadNotifications();

    return () => {
      isCurrent = false;
    };
  }, [isOpen, onCountChange, refreshKey]);

  if (!isOpen) return null;

  const closeOnBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };
  const markAsRead = async (notification: NotificationItem) => {
    setMarkingReadId(notification.id);
    setMarkReadErrors(current => {
      const next = { ...current };
      delete next[notification.id];
      return next;
    });

    try {
      await notificationsApi.markAsRead(notification.id);
      setNotifications(current => current.map(item => (
        item.id === notification.id ? { ...item, isRead: true } : item
      )));
      onCountChange(Math.max(0, notifications.filter(item => !item.isRead).length - 1));
    } catch (error) {
      setMarkReadErrors(current => ({
        ...current,
        [notification.id]: `Could not mark as read: ${getErrorMessage(error)}`,
      }));
    } finally {
      setMarkingReadId(null);
    }
  };

  const markAllAsRead = async () => {
    setIsMarkingAllRead(true);
    setMarkAllReadError(null);

    try {
      await notificationsApi.markAllAsRead();
      setNotifications(current => current.map(notification => (
        notification.canMarkRead ? { ...notification, isRead: true } : notification
      )));
      setMarkReadErrors({});
      onCountChange(notifications.filter(notification => !notification.canMarkRead && !notification.isRead).length);
    } catch (error) {
      setMarkAllReadError(`Could not mark all as read: ${getErrorMessage(error)}`);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const hasUnreadNotifications = notifications.some(
    notification => notification.canMarkRead && !notification.isRead
  );

  const severityStyles: Record<NotificationSeverity, string> = {
    critical: 'border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30',
    warning: 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30',
    success: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30',
  };

  const severityLabels: Record<NotificationSeverity, string> = {
    critical: 'Needs attention',
    warning: 'Warning',
    success: 'Success',
  };
  const kindLabels: Record<NotificationKind, string> = {
    license: 'License',
    site: 'Network site',
    message: 'Message delivery',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={closeOnBackdrop}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-modal-title"
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div>
            <h2 id="notification-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
              Notifications
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              License status and notifications for this admin account
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800 sm:px-6">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {notifications.length} active alert{notifications.length === 1 ? '' : 's'}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void markAllAsRead()}
              disabled={!hasUnreadNotifications || isMarkingAllRead || markingReadId !== null}
              className="text-xs font-semibold p-1 rounded-md text-red-600 bg-red-100 dark:bg-red-900/50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
            >
              {isMarkingAllRead ? 'Marking...' : 'Mark all as read'}
            </button>
            <button
              type="button"
              onClick={() => {
                setLastUpdated(null);
                setRefreshKey(key => key + 1);
              }}
              className="text-xs font-semibold p-1 rounded-md text-lime-600 bg-lime-100 dark:bg-slate-900/50 hover:text-lime-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-lime-400 dark:hover:text-lime-300"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {markAllReadError && (
            <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
              {markAllReadError}
            </p>
          )}
          {errors.length > 0 && (
            <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="mb-1 font-bold">Some notification sources are unavailable</p>
              <ul className="list-inside list-disc space-y-1">
                {errors.map(error => <li key={error}>{error}</li>)}
              </ul>
            </div>
          )}

          {isLoading ? (
            <div role="status" className="flex items-center justify-center gap-3 py-12 text-sm text-slate-500 dark:text-slate-400">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" aria-hidden="true" />
              Loading notifications...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">You're all caught up</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">No active issues were found.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {notifications.map(notification => (
                <li
                  key={notification.id}
                  className={`rounded-xl border p-4 ${severityStyles[notification.severity]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {kindLabels[notification.kind]}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      {notification.canMarkRead && (
                        <button
                          type="button"
                          onClick={() => void markAsRead(notification)}
                          disabled={notification.isRead || markingReadId !== null || isMarkingAllRead}
                          className="rounded-md px-2 py-1 text-[10px] font-semibold text-blue-700 transition-colors bg-blue-100 dark:bg-blue-900/60 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/80 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {notification.isRead ? 'Read' : markingReadId === notification.id ? 'Marking...' : 'Mark as read'}
                        </button>
                      )}
                      <span className="shrink-0 rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                        {severityLabels[notification.severity]}
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white">{notification.title}</p>
                    <p className="mt-1 break-words text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {notification.description}
                    </p>
                    {notification.timestamp && (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(notification.timestamp)}
                      </p>
                    )}
                    {markReadErrors[notification.id] && (
                      <p role="alert" className="mt-2 text-xs text-rose-700 dark:text-rose-300">
                        {markReadErrors[notification.id]}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-slate-100 px-5 py-3 text-right text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:px-6">
          {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : ' '}
        </footer>
      </section>
    </div>
  );
};

export default NotificationModal;