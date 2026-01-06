'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Send, Loader2, CheckCircle, XCircle, Users, Filter, Radio, MapPin } from 'lucide-react';
import Swal from 'sweetalert2';

interface User {
  id: string;
  name: string;
  username: string;
  phone: string;
  address: string;
  status: string;
  profile?: { name: string };
  router?: { name: string };
  odpAssignment?: {
    odp: {
      id: string;
      name: string;
      odcId: string | null;
      odc?: {
        id: string;
        name: string;
      } | null;
    };
  } | null;
}

export default function SendMessagePage() {
  // Single message states
  const [phoneNumber, setPhoneNumber] = useState('');
  const [singleMessage, setSingleMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Broadcast states
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<any>(null);

  // Filter states
  const [filters, setFilters] = useState<any>({
    profiles: [],
    routers: [],
    statuses: [],
    odcs: [],
    odps: [],
  });
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [profileFilter, setProfileFilter] = useState<string>('');
  const [routerFilter, setRouterFilter] = useState<string>('');
  const [addressFilter, setAddressFilter] = useState<string>('');
  const [odcFilter, setOdcFilter] = useState<string>('');
  const [odpFilters, setOdpFilters] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Template states
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  useEffect(() => {
    loadUsers();
    loadTemplates();
  }, [statusFilter, profileFilter, routerFilter, addressFilter, odcFilter, odpFilters]);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (profileFilter) params.append('profileId', profileFilter);
      if (routerFilter) params.append('routerId', routerFilter);
      if (addressFilter) params.append('address', addressFilter);
      if (odcFilter) params.append('odcId', odcFilter);
      if (odpFilters.length > 0) params.append('odpIds', odpFilters.join(','));

      const res = await fetch(`/api/users/list?${params}`);
      const data = await res.json();

      if (data.success) {
        setUsers(data.users);
        setFilters(data.filters);
      }
    } catch (error) {
      console.error('Load users error:', error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch('/api/whatsapp/templates');
      const data = await res.json();

      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Load templates error:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setBroadcastMessage(template.message);
      Swal.fire({
        icon: 'success',
        title: 'Template Loaded!',
        text: `${template.name} loaded. You can edit before sending.`,
        timer: 2000,
        showConfirmButton: false,
      });
    }
  };

  const handleSingleSend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneNumber || !singleMessage) {
      Swal.fire('Error!', 'Phone number and message are required', 'error');
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber, message: singleMessage }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        Swal.fire('Berhasil!', `Message sent via ${data.provider}!`, 'success');
        setResult({
          success: true,
          provider: data.provider,
          attempts: data.attempts,
          response: data.response,
        });
        setSingleMessage('');
      } else {
        Swal.fire('Error!', data.error || 'Failed to send message', 'error');
        setResult({
          success: false,
          error: data.error,
          attempts: data.attempts,
        });
      }
    } catch (error) {
      console.error('Send error:', error);
      Swal.fire('Error!', 'Failed to send message', 'error');
      setResult({
        success: false,
        error: 'Network error',
      });
    } finally {
      setSending(false);
    }
  };

  const handleBroadcast = async () => {
    if (selectedUsers.size === 0) {
      Swal.fire('Error!', 'Please select at least one user', 'error');
      return;
    }

    if (!broadcastMessage) {
      Swal.fire('Error!', 'Message is required', 'error');
      return;
    }

    const confirmed = await Swal.fire({
      title: 'Confirm Broadcast',
      html: `Send message to <strong>${selectedUsers.size}</strong> users?<br/><small>This may take a while...</small>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Send!',
      cancelButtonText: 'Cancel',
    });

    if (!confirmed.isConfirmed) return;

    setBroadcasting(true);
    setBroadcastResult(null);

    try {
      const res = await fetch('/api/whatsapp/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: Array.from(selectedUsers),
          message: broadcastMessage,
          delay: 2000,
        }),
      });

      const data = await res.json();

      if (data.success) {
        Swal.fire(
          'Broadcast Complete!',
          `✅ Success: ${data.successCount}<br/>❌ Failed: ${data.failCount}`,
          'success'
        );
        setBroadcastResult(data);
        setSelectedUsers(new Set());
      } else {
        Swal.fire('Error!', data.error || 'Broadcast failed', 'error');
      }
    } catch (error) {
      console.error('Broadcast error:', error);
      Swal.fire('Error!', 'Failed to send broadcast', 'error');
    } finally {
      setBroadcasting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(users.map((u) => u.id)));
    }
  };

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const toggleOdpFilter = (odpId: string) => {
    setOdpFilters((prev) =>
      prev.includes(odpId) ? prev.filter((id) => id !== odpId) : [...prev, odpId]
    );
  };

  const clearOdpFilters = () => {
    setOdpFilters([]);
  };

  const getFilteredOdps = () => {
    if (!odcFilter) return filters.odps;
    return filters.odps.filter((odp: any) => odp.odcId === odcFilter);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Send WhatsApp Message</h1>
        <p className="text-gray-500 mt-1">Send single message or broadcast to multiple users</p>
      </div>

      <Tabs defaultValue="single" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="single">
            <Send className="h-4 w-4 mr-2" />
            Single Message
          </TabsTrigger>
          <TabsTrigger value="broadcast">
            <Users className="h-4 w-4 mr-2" />
            Broadcast
          </TabsTrigger>
        </TabsList>

        {/* Single Message Tab */}
        <TabsContent value="single" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Send Message</CardTitle>
                <CardDescription>Message will be sent using available providers</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSingleSend} className="space-y-4">
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="628123456789"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      value={singleMessage}
                      onChange={(e) => setSingleMessage(e.target.value)}
                      placeholder="Type your message..."
                      rows={6}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">{singleMessage.length} characters</p>
                  </div>

                  <Button type="submit" disabled={sending} className="w-full">
                    {sending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Result</CardTitle>
                <CardDescription>Message delivery status</CardDescription>
              </CardHeader>
              <CardContent>
                {!result && (
                  <div className="text-center py-12 text-gray-400">
                    <Send className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Send a message to see the result</p>
                  </div>
                )}

                {result && result.success && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-green-600">
                      <CheckCircle className="h-8 w-8" />
                      <div>
                        <div className="font-bold text-lg">Message Sent!</div>
                        <div className="text-sm">Via {result.provider}</div>
                      </div>
                    </div>
                  </div>
                )}

                {result && !result.success && (
                  <div className="flex items-center gap-3 text-red-600">
                    <XCircle className="h-8 w-8" />
                    <div>
                      <div className="font-bold text-lg">Failed</div>
                      <div className="text-sm">{result.error}</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Broadcast Tab */}
        <TabsContent value="broadcast" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Filter Users</CardTitle>
                  <CardDescription>Select users to receive broadcast message</CardDescription>
                </div>
                <Badge variant="outline" className="text-lg">
                  {selectedUsers.size} / {users.length} selected
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-4">
                {/* Network Location Filters */}
                <div className="border rounded-lg p-4 bg-blue-50">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <h3 className="font-semibold text-blue-900">Filter by Network Location</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>ODC (Optical Distribution Cabinet)</Label>
                      <Select
                        value={odcFilter || 'all'}
                        onValueChange={(val) => {
                          setOdcFilter(val === 'all' ? '' : val);
                          setOdpFilters([]); // Clear ODP selection when ODC changes
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All ODCs" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All ODCs</SelectItem>
                          {filters.odcs.map((odc: any) => (
                            <SelectItem key={odc.id} value={odc.id}>
                              {odc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>ODP (Optical Distribution Point)</Label>
                        {odpFilters.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={clearOdpFilters}
                            className="h-6 text-xs"
                          >
                            Clear ({odpFilters.length})
                          </Button>
                        )}
                      </div>
                      <div className="border rounded-lg p-2 max-h-32 overflow-y-auto bg-white">
                        {getFilteredOdps().length === 0 ? (
                          <p className="text-sm text-gray-400 text-center py-2">
                            {odcFilter ? 'No ODPs in this ODC' : 'Select ODC first'}
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {getFilteredOdps().map((odp: any) => (
                              <div key={odp.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`odp-${odp.id}`}
                                  checked={odpFilters.includes(odp.id)}
                                  onCheckedChange={() => toggleOdpFilter(odp.id)}
                                />
                                <label
                                  htmlFor={`odp-${odp.id}`}
                                  className="text-sm cursor-pointer flex-1"
                                >
                                  {odp.name}
                                </label>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {odpFilters.length === 0
                          ? 'Select one or more ODPs'
                          : `${odpFilters.length} ODP(s) selected`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Other Filters */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Status</Label>
                  <Select value={statusFilter || 'all'} onValueChange={(val) => setStatusFilter(val === 'all' ? '' : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {filters.statuses.map((status: string) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Profile</Label>
                  <Select value={profileFilter || 'all'} onValueChange={(val) => setProfileFilter(val === 'all' ? '' : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Profiles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Profiles</SelectItem>
                      {filters.profiles.map((profile: any) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Router</Label>
                  <Select value={routerFilter || 'all'} onValueChange={(val) => setRouterFilter(val === 'all' ? '' : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Routers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Routers</SelectItem>
                      {filters.routers.map((router: any) => (
                        <SelectItem key={router.id} value={router.id}>
                          {router.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Address</Label>
                    <Input
                      placeholder="Search address..."
                      value={addressFilter}
                      onChange={(e) => setAddressFilter(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {loadingUsers ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={selectedUsers.size === users.length && users.length > 0}
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Profile</TableHead>
                        <TableHead>ODP</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                            No users found
                          </TableCell>
                        </TableRow>
                      ) : (
                        users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedUsers.has(user.id)}
                                onCheckedChange={() => toggleUser(user.id)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell>{user.username}</TableCell>
                            <TableCell>{user.phone || '-'}</TableCell>
                            <TableCell>{user.profile?.name || '-'}</TableCell>
                            <TableCell>
                              <div className="text-xs">
                                {user.odpAssignment ? (
                                  <>
                                    <div className="font-medium">
                                      {user.odpAssignment.odp.name}
                                    </div>
                                    {user.odpAssignment.odp.odc && (
                                      <div className="text-gray-500">
                                        {user.odpAssignment.odp.odc.name}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={user.status === 'active' ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {user.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Broadcast Message</CardTitle>
              <CardDescription>
                Message will be personalized for each user. Use variables: {'{{customerName}}'},{' '}
                {'{{username}}'}, {'{{profileName}}'}, {'{{companyName}}'}, {'{{companyPhone}}'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Template Selector */}
              <div>
                <Label>Load from Template (Optional)</Label>
                <Select onValueChange={loadTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  💡 Select a template to load it. You can edit the message before sending.
                </p>
              </div>
              <Textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Type your broadcast message here..."
                rows={8}
              />
              <p className="text-xs text-gray-500">{broadcastMessage.length} characters</p>

              <Button
                onClick={handleBroadcast}
                disabled={broadcasting || selectedUsers.size === 0}
                className="w-full"
                size="lg"
              >
                {broadcasting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending to {selectedUsers.size} users...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Broadcast to {selectedUsers.size} Users
                  </>
                )}
              </Button>

              {broadcastResult && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <div className="font-medium mb-2">Broadcast Summary:</div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">Total</div>
                      <div className="text-2xl font-bold">{broadcastResult.total}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Success</div>
                      <div className="text-2xl font-bold text-green-600">
                        {broadcastResult.successCount}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Failed</div>
                      <div className="text-2xl font-bold text-red-600">
                        {broadcastResult.failCount}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
