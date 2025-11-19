import React, { useMemo, useRef, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Stack,
  TextField,
  InputAdornment,
  Divider,
  Fab,
  Pagination
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
  Phone,
  Email,
  Person,
  Search as SearchIcon,
  AssignmentTurnedIn,
  PendingActions,
  CheckCircle,
  Add as AddIcon
} from '@mui/icons-material';

const statusPalette = [
  { id: 'New', label: 'New', color: '#1e88e5', accent: '#e3f2fd' },
  { id: 'Contacted', label: 'Contacted', color: '#fb8c00', accent: '#fff3e0' },
  { id: 'Hold', label: 'Hold', color: '#6d4c41', accent: '#efebe9' },
  { id: 'Approval Required', label: 'Approval Required', color: '#8e24aa', accent: '#f3e5f5' },
  { id: 'Completed', label: 'Completed', color: '#2e7d32', accent: '#e8f5e9' },
  { id: 'Others', label: 'Others', color: '#546e7a', accent: '#eceff1' },
  { id: 'Not Applicable', label: 'Not Applicable', color: '#9e9e9e', accent: '#f5f5f5' }
];

const initialTickets = [
  {
    id: 'TR-001',
    title: 'Street light not working',
    description: 'Resident reported blackout in Block A street #4.',
    reportedBy: 'Hamza Farooq',
    contact: '0300-1234567',
    email: 'hamza@example.com',
    priority: 'High',
    category: 'Utilities',
    assignedTo: 'Maintenance',
    updatedAt: '2025-11-18',
    status: 'New'
  },
  {
    id: 'TR-002',
    title: 'Water pressure issue',
    description: 'Low pressure in Phase 2 – needs inspection.',
    reportedBy: 'Rabia Khalid',
    contact: '0315-7654321',
    email: 'rabia@example.com',
    priority: 'Medium',
    category: 'Infrastructure',
    assignedTo: 'Operations',
    updatedAt: '2025-11-17',
    status: 'Contacted'
  },
  {
    id: 'TR-003',
    title: 'Plot demarcation query',
    description: 'Buyer requesting expedited demarcation schedule.',
    reportedBy: 'Zain Ali',
    contact: '0345-9087766',
    email: 'zain@example.com',
    priority: 'Low',
    category: 'Documentation',
    assignedTo: 'Land Dept.',
    updatedAt: '2025-11-15',
    status: 'Approval Required'
  },
  {
    id: 'TR-004',
    title: 'Security guard rotation',
    description: 'Request for additional guards on Main Boulevard.',
    reportedBy: 'Security Team',
    contact: 'N/A',
    email: 'security@tajres.com',
    priority: 'High',
    category: 'Security',
    assignedTo: 'HR & Security',
    updatedAt: '2025-11-12',
    status: 'Hold'
  },
  {
    id: 'TR-005',
    title: 'Tree trimming completed',
    description: 'Civic maintenance completed as requested.',
    reportedBy: 'Civic Dept.',
    contact: '021-1234567',
    email: 'civic@example.com',
    priority: 'Medium',
    category: 'Civic',
    assignedTo: 'Landscape',
    updatedAt: '2025-11-10',
    status: 'Completed'
  }
];

const priorityColors = {
  High: '#d32f2f',
  Medium: '#ed6c02',
  Low: '#0288d1'
};

const ComplainsTickets = () => {
  const [tickets, setTickets] = useState(initialTickets);
  const [draggedTicket, setDraggedTicket] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const maxPages = 50;
  const draggedTicketRef = useRef(null);

  const filteredTickets = useMemo(() => {
    if (!searchTerm.trim()) return tickets;
    const q = searchTerm.toLowerCase();
    return tickets.filter(ticket =>
      ticket.title.toLowerCase().includes(q) ||
      ticket.reportedBy.toLowerCase().includes(q) ||
      ticket.category.toLowerCase().includes(q) ||
      ticket.id.toLowerCase().includes(q)
    );
  }, [tickets, searchTerm]);

  const filteredAndSorted = useMemo(() => filteredTickets.slice().sort((a, b) => {
    const orderMap = statusPalette.reduce((acc, status, index) => {
      acc[status.id] = index;
      return acc;
    }, {});
    const statusOrder = orderMap[a.status] - orderMap[b.status];
    if (statusOrder !== 0) return statusOrder;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  }), [filteredTickets]);

  const groupedTickets = useMemo(() => {
    const grouped = {};
    statusPalette.forEach(status => {
      grouped[status.id] = filteredAndSorted.filter(ticket => ticket.status === status.id);
    });
    return grouped;
  }, [filteredAndSorted]);

  const totalPages = useMemo(
    () => Math.max(1, Math.min(maxPages, Math.ceil(filteredTickets.length / pageSize))),
    [filteredTickets.length]
  );

  React.useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const statCards = useMemo(() => ([
    {
      label: 'Total Tickets',
      value: filteredTickets.length,
      icon: <AssignmentTurnedIn />,
      color: '#1976d2'
    },
    {
      label: 'Awaiting Response',
      value: groupedTickets['New']?.length || 0,
      icon: <PendingActions />,
      color: '#fb8c00'
    },
    {
      label: 'Completed',
      value: groupedTickets['Completed']?.length || 0,
      icon: <CheckCircle />,
      color: '#2e7d32'
    },
    {
      label: 'Approval Required',
      value: groupedTickets['Approval Required']?.length || 0,
      icon: <CheckCircle />,
      color: '#8e24aa'
    }
  ]), [filteredTickets.length, groupedTickets]);

  const handleDragStart = (e, ticket) => {
    draggedTicketRef.current = ticket;
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTicket(ticket);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = useCallback(
    (e, newStatus) => {
      e.preventDefault();
      const ticket = draggedTicketRef.current;
      if (!ticket || ticket.status === newStatus) {
        setDraggedTicket(null);
        draggedTicketRef.current = null;
        return;
      }
      setTickets(prev =>
        prev.map(item =>
          item.id === ticket.id
            ? {
                ...item,
                status: newStatus,
                updatedAt: new Date().toISOString().split('T')[0]
              }
            : item
        )
      );
      setDraggedTicket(null);
      draggedTicketRef.current = null;
    },
    []
  );

  const handleDragEnd = () => {
    setDraggedTicket(null);
    draggedTicketRef.current = null;
  };

  const TicketCard = ({ ticket }) => {
    const statusColor = statusPalette.find(s => s.id === ticket.status)?.color || '#cfd8dc';
    return (
      <Card
        draggable
        onDragStart={(e) => handleDragStart(e, ticket)}
        onDragEnd={handleDragEnd}
        sx={{
          mb: 2.5,
          cursor: 'grab',
          opacity: draggedTicket?.id === ticket.id ? 0.4 : 1,
          borderRadius: 3,
          border: `1px solid rgba(0,0,0,.05)`,
          boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
          '&:hover': { boxShadow: '0 15px 35px rgba(15,23,42,0.12)' },
          '&:active': { cursor: 'grabbing' }
        }}
      >
        <Box sx={{ height: 4, bgcolor: statusColor, borderTopLeftRadius: 12, borderTopRightRadius: 12 }} />
        <CardContent sx={{ p: 2.25 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={1.5}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom noWrap>
                {ticket.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                #{ticket.id} · {ticket.category}
              </Typography>
            </Box>
            <Box>
              <Tooltip title="View ticket">
                <IconButton size="small">
                  <ViewIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit ticket">
                <IconButton size="small">
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Stack>

          <Typography variant="body2" color="text.secondary" mb={1.5}>
            {ticket.description}
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" mb={1.5}>
            <Chip
              label={ticket.assignedTo}
              size="small"
              sx={{
                bgcolor: '#f1f5ff',
                color: '#1e40af',
                fontWeight: 600,
                textTransform: 'capitalize'
              }}
            />
            <Chip
              label={ticket.priority}
              size="small"
              sx={{
                bgcolor: priorityColors[ticket.priority] || '#9e9e9e',
                color: '#fff',
                fontWeight: 600
              }}
            />
          </Stack>

          <Stack spacing={1} mb={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Avatar sx={{ width: 32, height: 32, bgcolor: statusColor, fontSize: 14 }}>
                <Person fontSize="small" />
              </Avatar>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Reported By
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {ticket.reportedBy}
                </Typography>
              </Box>
            </Stack>
            {ticket.contact !== 'N/A' && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Phone sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption">{ticket.contact}</Typography>
              </Stack>
            )}
            <Stack direction="row" spacing={1} alignItems="center">
              <Email sx={{ fontSize: 16, color: 'text.secondary' }} />
              <Typography variant="caption">{ticket.email}</Typography>
            </Stack>
          </Stack>

          <Divider sx={{ my: 1.5 }} />
          <Box display="flex" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary">
              Updated {ticket.updatedAt}
            </Typography>
            <Typography variant="caption" fontWeight={700} color={statusColor}>
              {ticket.status}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  };

  const KanbanColumn = ({ status }) => (
    <Paper
      onDragOver={handleDragOver}
      onDrop={(e) => handleDrop(e, status.id)}
      sx={{
        minWidth: 320,
        maxWidth: 340,
        minHeight: '72vh',
        bgcolor: '#ffffff',
        p: 2.5,
        borderRadius: 3,
        border: '1px solid #e3e5f0',
        boxShadow: '0 20px 35px rgba(15,23,42,0.08)',
        display: 'flex',
        flexDirection: 'column',
        backgroundImage: `linear-gradient(to bottom, ${status.accent}, #fff)`
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: status.color,
              boxShadow: `0 0 8px ${status.color}`
            }}
          />
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {status.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {groupedTickets[status.id]?.length || 0} tickets
            </Typography>
          </Box>
        </Stack>
        <Chip
          label={groupedTickets[status.id]?.length || 0}
          size="small"
          sx={{ bgcolor: status.color, color: '#fff', fontWeight: 700 }}
        />
      </Stack>

      <Box sx={{ maxHeight: 'calc(72vh - 90px)', overflowY: 'auto', pr: 1 }}>
        {groupedTickets[status.id]?.length ? (
          groupedTickets[status.id]
            .slice((page - 1) * pageSize, page * pageSize)
            .map(ticket => <TicketCard key={ticket.id} ticket={ticket} />)
        ) : (
          <Box
            sx={{
              border: '2px dashed #cfd8dc',
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              color: 'text.secondary'
            }}
          >
            <Typography variant="body2">Drop tickets here</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#f5f6fa', minHeight: '100vh', position: 'relative' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" gap={2} mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Complains & Tickets
          </Typography>
        </Box>
        <Tooltip title="Refresh board">
          <IconButton sx={{ bgcolor: '#fff', boxShadow: 2 }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      <Grid container spacing={2} mb={3}>
        {statCards.map(card => (
          <Grid item xs={12} sm={6} md={3} key={card.label}>
            <Paper sx={{ p: 2, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2, boxShadow: '0 15px 30px rgba(15,23,42,0.08)' }}>
              <Avatar sx={{ bgcolor: card.color, width: 46, height: 46 }}>
                {card.icon}
              </Avatar>
              <Box>
                <Typography variant="h6" fontWeight={700}>
                  {card.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {card.label}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Paper sx={{ mb: 3, p: 2.5, borderRadius: 3, boxShadow: '0 10px 30px rgba(15,23,42,0.08)' }}>
        <TextField
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search tickets by title, reporter, category..."
          fullWidth
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
        {statusPalette.map(status => (
          <KanbanColumn status={status} key={status.id} />
        ))}
      </Box>

      <Box display="flex" justifyContent="center" mt={2}>
        <Pagination
          count={totalPages}
          page={Math.min(page, totalPages)}
          onChange={(_, value) => setPage(value)}
          color="primary"
          shape="rounded"
        />
      </Box>

    </Box>
  );
};

export default ComplainsTickets;

