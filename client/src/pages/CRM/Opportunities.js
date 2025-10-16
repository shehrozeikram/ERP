import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Button,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Card,
  CardContent,
  Avatar,
  Tooltip,
  Alert,
  Skeleton,
  Fab,
  Switch,
  FormControlLabel,
  LinearProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  AttachMoney as MoneyIcon,
  People as PeopleIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  MoreVert as MoreIcon,
  CalendarToday as CalendarIcon,
  Assessment as AssessmentIcon,
  Timeline as TimelineIcon,
  ExpandMore as ExpandMoreIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  LocationOn as LocationIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  DragIndicator as DragIndicatorIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { formatPKR } from '../../utils/currency';

const Opportunities = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  
  // State management
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // View mode
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'kanban'
  const [selectedStage, setSelectedStage] = useState('all');
  
  // Drag and drop state
  const [draggedOpportunity, setDraggedOpportunity] = useState(null);
  const draggedOpportunityRef = useRef(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  
  // Filters and search
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    stage: '',
    priority: '',
    type: '',
    assignedTo: '',
    company: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Dialog states
  const [opportunityDialog, setOpportunityDialog] = useState({
    open: false,
    mode: 'add', // 'add' or 'edit'
    opportunity: null
  });
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    opportunity: null
  });
  const [activityDialog, setActivityDialog] = useState({
    open: false,
    opportunity: null
  });
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    stage: 'Prospecting',
    probability: 10,
    amount: '',
    currency: 'PKR',
    expectedCloseDate: '',
    source: 'Other',
    priority: 'Medium',
    type: 'New Business',
    company: '',
    contact: '',
    assignedTo: user?.id || ''
  });

  // Activity form data
  const [activityData, setActivityData] = useState({
    type: 'Call',
    subject: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    duration: '',
    outcome: ''
  });

  // Load opportunities data
  const loadOpportunities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // In Kanban view, load all opportunities (no pagination)
      const params = {
        page: viewMode === 'kanban' ? 1 : page + 1,
        limit: viewMode === 'kanban' ? 1000 : rowsPerPage, // Load more for Kanban
        search,
        ...filters,
        _t: Date.now()
      };

      const response = await api.get('/crm/opportunities', { 
        params,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      
      if (response && response.data && response.data.data) {
        const opportunitiesArray = response.data.data.opportunities || [];
        const totalItems = response.data.data.pagination?.totalItems || 0;
        const totalPages = response.data.data.pagination?.totalPages || 0;
        
        setOpportunities(opportunitiesArray);
        setTotalItems(totalItems);
        setTotalPages(totalPages);
      } else {
        setOpportunities([]);
        setTotalItems(0);
        setTotalPages(0);
      }
    } catch (err) {
      setError('Failed to load opportunities. Please try again.');
      setOpportunities([]);
      setTotalItems(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, filters, user, token, viewMode]);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  // Handle search
  const handleSearch = (event) => {
    setSearch(event.target.value);
    setPage(0);
  };

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  };

  // Handle form field changes
  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle activity form changes
  const handleActivityChange = (field, value) => {
    setActivityData(prev => ({ ...prev, [field]: value }));
  };

  // Open add opportunity dialog
  const handleAddOpportunity = () => {
    setFormData({
      title: '',
      description: '',
      stage: 'Prospecting',
      probability: 10,
      amount: '',
      currency: 'PKR',
      expectedCloseDate: '',
      source: 'Other',
      priority: 'Medium',
      type: 'New Business',
      company: '',
      contact: '',
      assignedTo: user?.id || ''
    });
    setOpportunityDialog({ open: true, mode: 'add', opportunity: null });
  };

  // Open edit opportunity dialog
  const handleEditOpportunity = (opportunity) => {
    
    setFormData({
      title: opportunity.title || '',
      description: opportunity.description || '',
      stage: opportunity.stage || 'Prospecting',
      probability: opportunity.probability || 10,
      amount: opportunity.amount || '',
      currency: opportunity.currency || 'PKR',
      expectedCloseDate: opportunity.expectedCloseDate ? new Date(opportunity.expectedCloseDate).toISOString().split('T')[0] : '',
      source: opportunity.source || 'Other',
      priority: opportunity.priority || 'Medium',
      type: opportunity.type || 'New Business',
      company: opportunity.company?._id || '',
      contact: opportunity.contact?._id || '',
      assignedTo: opportunity.assignedTo?._id || user?.id || ''
    });
    setOpportunityDialog({ open: true, mode: 'edit', opportunity });
  };

  // Open activity dialog
  const handleAddActivity = (opportunity) => {
    setActivityData({
      type: 'Call',
      subject: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      duration: '',
      outcome: ''
    });
    setActivityDialog({ open: true, opportunity });
  };

  // Save opportunity
  const handleSaveOpportunity = async () => {
    try {
      
      const opportunityData = {
        title: formData.title,
        description: formData.description,
        stage: formData.stage,
        probability: parseInt(formData.probability),
        amount: parseFloat(formData.amount) || 0,
        currency: formData.currency,
        expectedCloseDate: formData.expectedCloseDate,
        source: formData.source,
        priority: formData.priority,
        type: formData.type,
        company: formData.company,
        contact: formData.contact,
        assignedTo: formData.assignedTo
      };


      if (opportunityDialog.mode === 'add') {
        const response = await api.post('/crm/opportunities', opportunityData);
        setSuccess('Opportunity added successfully!');
      } else {
        const response = await api.put(`/crm/opportunities/${opportunityDialog.opportunity._id}`, opportunityData);
        setSuccess('Opportunity updated successfully!');
      }

      setOpportunityDialog({ open: false, mode: 'add', opportunity: null });
      setPage(0);
      setSearch('');
      setFilters({ stage: '', priority: '', type: '', assignedTo: '', company: '' });
      await loadOpportunities();
    } catch (err) {
      setError('Failed to save opportunity. Please try again.');
    }
  };

  // Add activity
  const handleSaveActivity = async () => {
    try {
      
      const activityUpdate = {
        type: activityData.type,
        subject: activityData.subject,
        description: activityData.description,
        date: activityData.date,
        duration: parseInt(activityData.duration) || 0,
        outcome: activityData.outcome
      };

      const response = await api.post(`/crm/opportunities/${activityDialog.opportunity._id}/activities`, activityUpdate);
      
      setActivityDialog({ open: false, opportunity: null });
      setSuccess('Activity added successfully!');
      await loadOpportunities();
    } catch (err) {
      setError('Failed to add activity. Please try again.');
    }
  };

  // Delete opportunity
  const handleDeleteOpportunity = async () => {
    try {
      
      const response = await api.delete(`/crm/opportunities/${deleteDialog.opportunity._id}`);
      
      setDeleteDialog({ open: false, opportunity: null });
      setSuccess('Opportunity deleted successfully!');
      setError(null);
      await loadOpportunities();
    } catch (err) {
      setError('Failed to delete opportunity. Please try again.');
      setSuccess(null);
    }
  };

  // Get stage color
  const getStageColor = (stage) => {
    switch (stage) {
      case 'Prospecting': return 'default';
      case 'Qualification': return 'info';
      case 'Proposal': return 'warning';
      case 'Negotiation': return 'secondary';
      case 'Closed Won': return 'success';
      case 'Closed Lost': return 'error';
      default: return 'default';
    }
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Low': return 'success';
      case 'Medium': return 'warning';
      case 'High': return 'error';
      case 'Urgent': return 'error';
      default: return 'default';
    }
  };

  // Format currency
  const formatCurrency = (amount, currency = 'PKR') => {
    if (!amount) return '₨0';
    return formatPKR(amount);
  };

  // Calculate weighted amount
  const calculateWeightedAmount = (amount, probability) => {
    return (amount * probability) / 100;
  };

  // Check if overdue
  const isOverdue = (expectedCloseDate) => {
    if (!expectedCloseDate) return false;
    return new Date() > new Date(expectedCloseDate);
  };

  // Get days until close
  const getDaysUntilClose = (expectedCloseDate) => {
    if (!expectedCloseDate) return null;
    const now = new Date();
    const closeDate = new Date(expectedCloseDate);
    const diffTime = closeDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Kanban stages configuration
  const kanbanStages = useMemo(() => [
    { id: 'Prospecting', label: 'Prospecting', color: '#2196F3' },
    { id: 'Qualification', label: 'Qualification', color: '#00BCD4' },
    { id: 'Proposal', label: 'Proposal', color: '#FF9800' },
    { id: 'Negotiation', label: 'Negotiation', color: '#9C27B0' },
    { id: 'Closed Won', label: 'Closed Won', color: '#4CAF50' },
    { id: 'Closed Lost', label: 'Closed Lost', color: '#F44336' }
  ], []);

  // Group opportunities by stage for Kanban view
  const groupedOpportunities = useMemo(() => {
    const grouped = {};
    kanbanStages.forEach(stage => {
      grouped[stage.id] = opportunities.filter(opp => opp.stage === stage.id);
    });
    return grouped;
  }, [opportunities, kanbanStages]);

  // Drag and drop handlers
  const handleDragStart = (e, opportunity) => {
    draggedOpportunityRef.current = opportunity;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', opportunity._id);
    
    requestAnimationFrame(() => {
      setDraggedOpportunity(opportunity);
    });
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragEnter = (e, columnId) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = (e, columnId) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e, newStage) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);

    const opportunity = draggedOpportunityRef.current;
    
    if (!opportunity || opportunity.stage === newStage) {
      setDraggedOpportunity(null);
      draggedOpportunityRef.current = null;
      return;
    }

    try {
      // Optimistic update
      setOpportunities(prevOpps =>
        prevOpps.map(opp =>
          opp._id === opportunity._id ? { ...opp, stage: newStage } : opp
        )
      );

      // Update on server
      await api.put(`/crm/opportunities/${opportunity._id}`, { stage: newStage });
      setSuccess(`Opportunity moved to ${newStage}`);
      
      // Refresh to ensure consistency
      loadOpportunities();
    } catch (err) {
      setError('Failed to update opportunity stage');
      loadOpportunities();
    } finally {
      setDraggedOpportunity(null);
      draggedOpportunityRef.current = null;
    }
  };

  const handleDragEnd = () => {
    setDraggedOpportunity(null);
    draggedOpportunityRef.current = null;
    setDragOverColumn(null);
  };

  // Kanban Card Component
  const KanbanOpportunityCard = ({ opportunity }) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
      <Card
        draggable={true}
        onDragStart={(e) => handleDragStart(e, opportunity)}
        onDragEnd={handleDragEnd}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        sx={{
          mb: 2,
          cursor: 'grab',
          opacity: draggedOpportunity?._id === opportunity._id ? 0.4 : 1,
          transform: draggedOpportunity?._id === opportunity._id ? 'scale(0.95)' : 'scale(1)',
          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
          userSelect: 'none',
          WebkitUserDrag: 'element',
          position: 'relative',
          '&:hover': {
            boxShadow: 4,
            transform: draggedOpportunity?._id === opportunity._id ? 'scale(0.95)' : 'translateY(-3px) scale(1.02)',
            borderColor: 'primary.main',
            transition: 'all 0.2s ease'
          },
          '&:active': {
            cursor: 'grabbing'
          }
        }}
      >
        {/* Drag Handle */}
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 4,
            opacity: isHovered ? 0.5 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: 'none',
            zIndex: 1
          }}
        >
          <DragIndicatorIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
        </Box>

        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          {/* Header */}
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
            <Box display="flex" alignItems="center" gap={1}>
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor: getStageColor(opportunity.stage) === 'success' ? '#4CAF50' :
                           getStageColor(opportunity.stage) === 'error' ? '#F44336' :
                           getStageColor(opportunity.stage) === 'warning' ? '#FF9800' :
                           getStageColor(opportunity.stage) === 'info' ? '#00BCD4' : '#2196F3',
                  fontSize: '0.875rem'
                }}
              >
                <MoneyIcon sx={{ fontSize: 18 }} />
              </Avatar>
              <Box>
                <Typography variant="subtitle2" fontWeight="bold" noWrap>
                  {opportunity.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {opportunity.company?.name || 'No Company'}
                </Typography>
              </Box>
            </Box>
            <Box display="flex" gap={0.5}>
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditOpportunity(opportunity);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Type & Priority */}
          <Box display="flex" gap={1} mb={1.5}>
            <Chip
              label={opportunity.type}
              size="small"
              sx={{
                backgroundColor: opportunity.type === 'New Business' ? '#2196F3' :
                                opportunity.type === 'Existing Business' ? '#4CAF50' :
                                opportunity.type === 'Renewal' ? '#FF9800' : '#9E9E9E',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.7rem',
                height: 20
              }}
            />
            <Chip
              label={opportunity.priority}
              size="small"
              sx={{
                backgroundColor: getPriorityColor(opportunity.priority) === 'error' ? '#F44336' :
                                getPriorityColor(opportunity.priority) === 'warning' ? '#FF9800' :
                                getPriorityColor(opportunity.priority) === 'success' ? '#4CAF50' : '#9E9E9E',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '0.7rem',
                height: 20
              }}
            />
          </Box>

          {/* Amount */}
          <Box mb={1}>
            <Typography variant="body2" fontWeight="600" color="primary" noWrap>
              {formatCurrency(opportunity.amount)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {opportunity.probability}% probability
            </Typography>
          </Box>

          {/* Contact/Assigned Info */}
          {opportunity.contact && (
            <Box display="flex" alignItems="center" mb={0.5}>
              <PersonIcon sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">
                {opportunity.contact.firstName} {opportunity.contact.lastName}
              </Typography>
            </Box>
          )}

          {/* Source & Close Date */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mt={1.5} pt={1.5} borderTop="1px solid #f0f0f0">
            <Typography variant="caption" color="text.secondary">
              {opportunity.source}
            </Typography>
            {opportunity.expectedCloseDate ? (
              <Box display="flex" alignItems="center">
                <Typography 
                  variant="caption" 
                  color={isOverdue(opportunity.expectedCloseDate) && opportunity.stage !== 'Closed Won' && opportunity.stage !== 'Closed Lost' ? 'error' : 'primary'}
                  fontWeight="bold"
                >
                  {getDaysUntilClose(opportunity.expectedCloseDate) !== null && getDaysUntilClose(opportunity.expectedCloseDate) < 0
                    ? `${Math.abs(getDaysUntilClose(opportunity.expectedCloseDate))} days overdue`
                    : getDaysUntilClose(opportunity.expectedCloseDate) === 0
                    ? 'Today'
                    : getDaysUntilClose(opportunity.expectedCloseDate) === 1
                    ? 'Tomorrow'
                    : `${getDaysUntilClose(opportunity.expectedCloseDate)} days`
                  }
                </Typography>
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary">
                {new Date(opportunity.createdAt).toLocaleDateString()}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  };

  // Kanban Column Component
  const KanbanColumn = ({ stage, opportunities: columnOpportunities }) => {
    const isOver = dragOverColumn === stage.id;
    const isDragging = draggedOpportunity !== null;
    const canDrop = isDragging && draggedOpportunity?.stage !== stage.id;

    return (
      <Paper
        onDragOver={(e) => handleDragOver(e, stage.id)}
        onDragEnter={(e) => handleDragEnter(e, stage.id)}
        onDragLeave={(e) => handleDragLeave(e, stage.id)}
        onDrop={(e) => handleDrop(e, stage.id)}
        sx={{
          minHeight: '70vh',
          backgroundColor: isOver && canDrop ? '#e3f2fd' : '#f5f5f5',
          p: 2,
          minWidth: 280,
          maxWidth: 320,
          border: isOver && canDrop ? '2px dashed' : '2px solid transparent',
          borderColor: isOver && canDrop ? stage.color : 'transparent',
          transition: 'all 0.2s ease',
          transform: isOver && canDrop ? 'scale(1.02)' : 'scale(1)',
          boxShadow: isOver && canDrop ? 3 : 1
        }}
      >
        {/* Column Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
            pb: 1.5,
            borderBottom: `3px solid ${stage.color}`
          }}
        >
          <Box display="flex" alignItems="center" gap={1}>
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: stage.color
              }}
            />
            <Typography variant="subtitle2" fontWeight="bold">
              {stage.label}
            </Typography>
            <Chip
              label={columnOpportunities.length}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                fontWeight: 'bold',
                backgroundColor: stage.color,
                color: 'white'
              }}
            />
          </Box>
        </Box>

        {/* Column Content */}
        <Box
          sx={{
            overflowY: 'auto',
            maxHeight: 'calc(70vh - 80px)',
            scrollBehavior: 'smooth',
            '&::-webkit-scrollbar': {
              width: 6
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: '#f1f1f1',
              borderRadius: 3
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: '#888',
              borderRadius: 3,
              '&:hover': {
                backgroundColor: '#555'
              }
            }
          }}
        >
          {columnOpportunities.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 200,
                border: isOver && canDrop ? '2px dashed' : '2px dashed #ddd',
                borderColor: isOver && canDrop ? stage.color : '#ddd',
                borderRadius: 1,
                backgroundColor: 'white',
                transition: 'all 0.2s ease'
              }}
            >
              <Typography
                variant="body2"
                color={isOver && canDrop ? 'primary' : 'text.secondary'}
                fontWeight={isOver && canDrop ? 'bold' : 'normal'}
              >
                {isOver && canDrop ? '✓ Drop opportunity here' : 'Drop opportunities here'}
              </Typography>
            </Box>
          ) : (
            columnOpportunities.map((opportunity) => (
              <KanbanOpportunityCard key={opportunity._id} opportunity={opportunity} />
            ))
          )}
        </Box>
      </Paper>
    );
  };

  // Opportunity card component
  const OpportunityCard = ({ opportunity }) => (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box display="flex" alignItems="center">
            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
              <BusinessIcon />
            </Avatar>
            <Box>
              <Typography variant="h6" component="h3" noWrap>
                {opportunity.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {opportunity.company?.name || 'No Company'}
              </Typography>
            </Box>
          </Box>
          <IconButton size="small">
            <MoreIcon />
          </IconButton>
        </Box>

        <Box mb={2}>
          <Chip 
            label={opportunity.stage} 
            size="small" 
            color={getStageColor(opportunity.stage)}
            sx={{ mr: 1 }}
          />
          <Chip 
            label={opportunity.priority} 
            size="small" 
            color={getPriorityColor(opportunity.priority)}
          />
        </Box>

        {opportunity.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {opportunity.description}
          </Typography>
        )}

        <Box mb={2}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <MoneyIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            {formatCurrency(opportunity.amount, opportunity.currency)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <TrendingUpIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            {opportunity.probability}% Probability
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <CalendarIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            Close: {new Date(opportunity.expectedCloseDate).toLocaleDateString()}
            {isOverdue(opportunity.expectedCloseDate) && (
              <WarningIcon sx={{ fontSize: 16, ml: 0.5, color: 'error.main' }} />
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <PeopleIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            {opportunity.contact?.firstName} {opportunity.contact?.lastName}
          </Typography>
        </Box>

        {/* Progress bar for probability */}
        <Box mb={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
            <Typography variant="caption" color="text.secondary">
              Probability
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {opportunity.probability}%
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={opportunity.probability} 
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Assigned to: {opportunity.assignedTo?.firstName} {opportunity.assignedTo?.lastName}
          </Typography>
          <Box>
            <Tooltip title="Add Activity">
              <IconButton size="small" onClick={() => handleAddActivity(opportunity)}>
                <TimelineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => handleEditOpportunity(opportunity)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete">
              <IconButton size="small" onClick={() => setDeleteDialog({ open: true, opportunity })}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );


  // Loading skeleton
  if (loading && opportunities.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Opportunities
        </Typography>
        <Grid container spacing={3}>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item}>
              <Skeleton variant="rectangular" height={300} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
          Opportunities
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={() => setShowFilters(!showFilters)}
            sx={{ mr: 1 }}
          >
            Filters
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            sx={{ mr: 1 }}
          >
            Export
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadOpportunities}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddOpportunity}
          >
            Add Opportunity
          </Button>
        </Box>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* View Mode Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={viewMode}
          onChange={(e, newValue) => setViewMode(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Grid View" value="grid" />
          <Tab label="Kanban View" value="kanban" />
        </Tabs>
      </Paper>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search opportunities..."
              value={search}
              onChange={handleSearch}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Grid>
          {showFilters && (
            <>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Stage</InputLabel>
                  <Select
                    value={filters.stage}
                    onChange={(e) => handleFilterChange('stage', e.target.value)}
                    label="Stage"
                  >
                    <MenuItem value="">All Stages</MenuItem>
                    <MenuItem value="Prospecting">Prospecting</MenuItem>
                    <MenuItem value="Qualification">Qualification</MenuItem>
                    <MenuItem value="Proposal">Proposal</MenuItem>
                    <MenuItem value="Negotiation">Negotiation</MenuItem>
                    <MenuItem value="Closed Won">Closed Won</MenuItem>
                    <MenuItem value="Closed Lost">Closed Lost</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={filters.priority}
                    onChange={(e) => handleFilterChange('priority', e.target.value)}
                    label="Priority"
                  >
                    <MenuItem value="">All Priorities</MenuItem>
                    <MenuItem value="Low">Low</MenuItem>
                    <MenuItem value="Medium">Medium</MenuItem>
                    <MenuItem value="High">High</MenuItem>
                    <MenuItem value="Urgent">Urgent</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={filters.type}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    label="Type"
                  >
                    <MenuItem value="">All Types</MenuItem>
                    <MenuItem value="New Business">New Business</MenuItem>
                    <MenuItem value="Existing Business">Existing Business</MenuItem>
                    <MenuItem value="Renewal">Renewal</MenuItem>
                    <MenuItem value="Upsell">Upsell</MenuItem>
                    <MenuItem value="Cross-sell">Cross-sell</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setFilters({ stage: '', priority: '', type: '', assignedTo: '', company: '' });
                    setSearch('');
                  }}
                  fullWidth
                >
                  Clear
                </Button>
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

      {/* Opportunities Grid/Kanban */}
      {viewMode === 'kanban' ? (
        <>
          {/* Kanban Info Banner */}
          <Alert 
            severity="info" 
            sx={{ 
              mb: 2,
              '& .MuiAlert-message': {
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }
            }}
          >
            <Box>
              <Typography variant="body2" fontWeight="bold">
                💡 Drag & Drop Enabled
              </Typography>
              <Typography variant="caption">
                Drag opportunity cards between columns to update their stage instantly
              </Typography>
            </Box>
          </Alert>

          <Box
            sx={{
              display: 'flex',
              gap: 2,
              overflowX: 'auto',
              pb: 2,
              '&::-webkit-scrollbar': {
                height: 8
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: '#f1f1f1'
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: '#888',
                borderRadius: 4
              },
              '&::-webkit-scrollbar-thumb:hover': {
                backgroundColor: '#555'
              }
            }}
          >
            {loading ? (
              // Loading skeleton for Kanban
              kanbanStages.map((stage) => (
                <Paper key={stage.id} sx={{ minWidth: 280, maxWidth: 320, p: 2, minHeight: '70vh' }}>
                  <Skeleton variant="text" width={150} height={30} sx={{ mb: 2 }} />
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} variant="rectangular" height={200} sx={{ mb: 2, borderRadius: 1 }} />
                  ))}
                </Paper>
              ))
            ) : (
              kanbanStages.map((stage) => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  opportunities={groupedOpportunities[stage.id] || []}
                />
              ))
            )}
          </Box>
        </>
      ) : viewMode === 'grid' ? (
        opportunities.length > 0 ? (
          <Grid container spacing={3}>
            {opportunities.map((opportunity) => (
              <Grid item xs={12} sm={6} md={4} key={opportunity._id}>
                <OpportunityCard opportunity={opportunity} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <BusinessIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No opportunities found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {search || Object.values(filters).some(f => f) 
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first opportunity'
              }
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddOpportunity}
            >
              Add Opportunity
            </Button>
          </Paper>
        )
      ) : null}

      {/* Add/Edit Opportunity Dialog */}
      <Dialog
        open={opportunityDialog.open}
        onClose={() => setOpportunityDialog({ open: false, mode: 'add', opportunity: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {opportunityDialog.mode === 'add' ? 'Add New Opportunity' : 'Edit Opportunity'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Opportunity Title"
                value={formData.title}
                onChange={(e) => handleFormChange('title', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={formData.description}
                onChange={(e) => handleFormChange('description', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required>
                <InputLabel>Stage</InputLabel>
                <Select
                  value={formData.stage}
                  onChange={(e) => handleFormChange('stage', e.target.value)}
                  label="Stage"
                >
                  <MenuItem value="Prospecting">Prospecting</MenuItem>
                  <MenuItem value="Qualification">Qualification</MenuItem>
                  <MenuItem value="Proposal">Proposal</MenuItem>
                  <MenuItem value="Negotiation">Negotiation</MenuItem>
                  <MenuItem value="Closed Won">Closed Won</MenuItem>
                  <MenuItem value="Closed Lost">Closed Lost</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Probability (%)"
                type="number"
                value={formData.probability}
                onChange={(e) => handleFormChange('probability', e.target.value)}
                inputProps={{ min: 0, max: 100 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Amount"
                type="number"
                value={formData.amount}
                onChange={(e) => handleFormChange('amount', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Currency</InputLabel>
                <Select
                  value={formData.currency}
                  onChange={(e) => handleFormChange('currency', e.target.value)}
                  label="Currency"
                >
                  <MenuItem value="PKR">PKR</MenuItem>
                  <MenuItem value="USD">USD</MenuItem>
                  <MenuItem value="EUR">EUR</MenuItem>
                  <MenuItem value="GBP">GBP</MenuItem>
                  <MenuItem value="CAD">CAD</MenuItem>
                  <MenuItem value="AUD">AUD</MenuItem>
                  <MenuItem value="INR">INR</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Expected Close Date"
                type="date"
                value={formData.expectedCloseDate}
                onChange={(e) => handleFormChange('expectedCloseDate', e.target.value)}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Source</InputLabel>
                <Select
                  value={formData.source}
                  onChange={(e) => handleFormChange('source', e.target.value)}
                  label="Source"
                >
                  <MenuItem value="Website">Website</MenuItem>
                  <MenuItem value="Referral">Referral</MenuItem>
                  <MenuItem value="Cold Call">Cold Call</MenuItem>
                  <MenuItem value="Email Campaign">Email Campaign</MenuItem>
                  <MenuItem value="Social Media">Social Media</MenuItem>
                  <MenuItem value="Trade Show">Trade Show</MenuItem>
                  <MenuItem value="Advertisement">Advertisement</MenuItem>
                  <MenuItem value="Partner">Partner</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  onChange={(e) => handleFormChange('priority', e.target.value)}
                  label="Priority"
                >
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                  <MenuItem value="Urgent">Urgent</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={formData.type}
                  onChange={(e) => handleFormChange('type', e.target.value)}
                  label="Type"
                >
                  <MenuItem value="New Business">New Business</MenuItem>
                  <MenuItem value="Existing Business">Existing Business</MenuItem>
                  <MenuItem value="Renewal">Renewal</MenuItem>
                  <MenuItem value="Upsell">Upsell</MenuItem>
                  <MenuItem value="Cross-sell">Cross-sell</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Company"
                value={formData.company}
                onChange={(e) => handleFormChange('company', e.target.value)}
                placeholder="Company name or ID"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contact"
                value={formData.contact}
                onChange={(e) => handleFormChange('contact', e.target.value)}
                placeholder="Contact name or ID"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpportunityDialog({ open: false, mode: 'add', opportunity: null })}>
            Cancel
          </Button>
          <Button onClick={handleSaveOpportunity} variant="contained">
            {opportunityDialog.mode === 'add' ? 'Add Opportunity' : 'Update Opportunity'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Activity Dialog */}
      <Dialog
        open={activityDialog.open}
        onClose={() => setActivityDialog({ open: false, opportunity: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Activity</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                {activityDialog.opportunity?.title}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Activity Type</InputLabel>
                <Select
                  value={activityData.type}
                  onChange={(e) => handleActivityChange('type', e.target.value)}
                  label="Activity Type"
                >
                  <MenuItem value="Call">Call</MenuItem>
                  <MenuItem value="Email">Email</MenuItem>
                  <MenuItem value="Meeting">Meeting</MenuItem>
                  <MenuItem value="Proposal">Proposal</MenuItem>
                  <MenuItem value="Follow-up">Follow-up</MenuItem>
                  <MenuItem value="Demo">Demo</MenuItem>
                  <MenuItem value="Quote">Quote</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date"
                type="date"
                value={activityData.date}
                onChange={(e) => handleActivityChange('date', e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Subject"
                value={activityData.subject}
                onChange={(e) => handleActivityChange('subject', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={activityData.description}
                onChange={(e) => handleActivityChange('description', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Duration (minutes)"
                type="number"
                value={activityData.duration}
                onChange={(e) => handleActivityChange('duration', e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Outcome"
                value={activityData.outcome}
                onChange={(e) => handleActivityChange('outcome', e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActivityDialog({ open: false, opportunity: null })}>
            Cancel
          </Button>
          <Button onClick={handleSaveActivity} variant="contained">
            Add Activity
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, opportunity: null })}
      >
        <DialogTitle>Delete Opportunity</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{deleteDialog.opportunity?.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, opportunity: null })}>
            Cancel
          </Button>
          <Button onClick={handleDeleteOpportunity} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Floating Action Button */}
      <Fab
        color="primary"
        aria-label="add"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        onClick={handleAddOpportunity}
      >
        <AddIcon />
      </Fab>
    </Box>
  );
};

export default Opportunities; 