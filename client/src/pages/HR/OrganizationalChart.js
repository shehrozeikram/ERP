import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Avatar,
  Container,
  Stack,
  Alert,
  Snackbar,
  LinearProgress,
  Grid,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
  FormControlLabel,
  InputAdornment,
  Badge,
  Fade,
  Slide,
  Grow,
  Zoom,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  AccountTree,
  Add,
  Edit,
  Delete,
  Visibility,
  ExpandMore,
  ExpandLess,
  Person,
  Business,
  ArrowDownward,
  ArrowUpward,
  ZoomIn,
  ZoomOut,
  Fullscreen,
  Print,
  Save,
  Cancel,
  MoreVert,
  Work,
  Group,
  SupervisorAccount,
  DragIndicator,
  Settings,
  Refresh,
  School,
  Search,
  FilterList,
  Download,
  Upload,
  Share,
  GetApp,
  PictureAsPdf,
  Image,
  TableChart,
  Timeline,
  TrendingUp,
  People,
  Assessment,
  Dashboard,
  ViewModule,
  ViewList,
  ViewComfy,
  AutoAwesome,
  Star,
  StarBorder,
  Favorite,
  Bookmark,
  BookmarkBorder,
  Info,
  Warning,
  Error,
  CheckCircle,
  Schedule,
  LocationOn,
  Phone,
  Email,
  Language,
  Public,
  Lock,
  Security,
  VerifiedUser,
  AdminPanelSettings,
  SupervisorAccount as ManagerIcon,
  Engineering,
  Factory,
  Calculate,
  TrendingUp as TrendingUpIcon,
  Verified,
  AccountBalance,
  School as SchoolIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';

const OrganizationalChart = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const chartRef = useRef(null);
  
  const [orgData, setOrgData] = useState({
    departments: [
      {
        id: 1,
        name: 'Executive Office',
        manager: 'CEO',
        employees: 3,
        level: 1,
        color: '#1976d2',
        icon: 'Business',
        status: 'active',
        description: 'Top-level executive management',
        location: 'Headquarters',
        phone: '+1-555-0100',
        email: 'ceo@company.com',
        website: 'www.company.com',
        budget: 5000000,
        children: [
          {
            id: 2,
            name: 'Human Resources',
            manager: 'HR Director',
            employees: 12,
            level: 2,
            color: '#dc004e',
            icon: 'Group',
            status: 'active',
            description: 'Human resources and employee management',
            location: 'Floor 2',
            phone: '+1-555-0101',
            email: 'hr@company.com',
            budget: 800000,
            children: [
              {
                id: 3,
                name: 'Recruitment',
                manager: 'Recruitment Manager',
                employees: 5,
                level: 3,
                color: '#9c27b0',
                icon: 'Work',
                status: 'active',
                description: 'Talent acquisition and recruitment',
                location: 'Floor 2 - East Wing',
                phone: '+1-555-0102',
                email: 'recruitment@company.com',
                budget: 300000,
                children: []
              },
              {
                id: 4,
                name: 'Training & Development',
                manager: 'Training Manager',
                employees: 4,
                level: 3,
                color: '#ff9800',
                icon: 'School',
                status: 'active',
                description: 'Employee training and development programs',
                location: 'Floor 2 - West Wing',
                phone: '+1-555-0103',
                email: 'training@company.com',
                budget: 250000,
                children: []
              }
            ]
          },
          {
            id: 5,
            name: 'Finance',
            manager: 'CFO',
            employees: 8,
            level: 2,
            color: '#4caf50',
            icon: 'AccountBalance',
            status: 'active',
            description: 'Financial management and accounting',
            location: 'Floor 3',
            phone: '+1-555-0104',
            email: 'finance@company.com',
            budget: 1200000,
            children: [
              {
                id: 6,
                name: 'Accounting',
                manager: 'Accounting Manager',
                employees: 4,
                level: 3,
                color: '#2196f3',
                icon: 'Calculate',
                status: 'active',
                description: 'Financial accounting and reporting',
                location: 'Floor 3 - North Wing',
                phone: '+1-555-0105',
                email: 'accounting@company.com',
                budget: 400000,
                children: []
              },
              {
                id: 7,
                name: 'Budgeting',
                manager: 'Budget Manager',
                employees: 3,
                level: 3,
                color: '#ff5722',
                icon: 'TrendingUp',
                status: 'active',
                description: 'Budget planning and financial analysis',
                location: 'Floor 3 - South Wing',
                phone: '+1-555-0106',
                email: 'budget@company.com',
                budget: 350000,
                children: []
              }
            ]
          },
          {
            id: 8,
            name: 'Operations',
            manager: 'COO',
            employees: 15,
            level: 2,
            color: '#795548',
            icon: 'Engineering',
            status: 'active',
            description: 'Operational management and production',
            location: 'Floor 4',
            phone: '+1-555-0107',
            email: 'operations@company.com',
            budget: 2000000,
            children: [
              {
                id: 9,
                name: 'Production',
                manager: 'Production Manager',
                employees: 8,
                level: 3,
                color: '#607d8b',
                icon: 'Factory',
                status: 'active',
                description: 'Production and manufacturing operations',
                location: 'Floor 4 - East Wing',
                phone: '+1-555-0108',
                email: 'production@company.com',
                budget: 800000,
                children: []
              },
              {
                id: 10,
                name: 'Quality Control',
                manager: 'QC Manager',
                employees: 4,
                level: 3,
                color: '#e91e63',
                icon: 'Verified',
                status: 'active',
                description: 'Quality assurance and control processes',
                location: 'Floor 4 - West Wing',
                phone: '+1-555-0109',
                email: 'qc@company.com',
                budget: 400000,
                children: []
              }
            ]
          }
        ]
      }
    ]
  });

  const [expandedNodes, setExpandedNodes] = useState(new Set([1, 2, 5, 8]));
  const [selectedNode, setSelectedNode] = useState(null);
  const [editDialog, setEditDialog] = useState({ open: false, node: null, isNew: false });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, node: null });
  const [zoom, setZoom] = useState(100);
  const [showConnectors, setShowConnectors] = useState(true);
  const [showEmployeeCount, setShowEmployeeCount] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [draggedNode, setDraggedNode] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('chart'); // chart, list, grid
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [showDetails, setShowDetails] = useState(false);
  const [autoLayout, setAutoLayout] = useState(true);
  const [animations, setAnimations] = useState(true);
  const [favorites, setFavorites] = useState(new Set());

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const toggleNode = (nodeId) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 20, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 20, 50));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  const handleAddDepartment = (parentId = null) => {
    const newNode = {
      id: Date.now(),
      name: '',
      manager: '',
      employees: 0,
      level: parentId ? 3 : 2,
      color: '#1976d2',
      icon: 'Business',
      status: 'active',
      description: '',
      location: '',
      phone: '',
      email: '',
      website: '',
      budget: 0,
      children: []
    };
    setEditDialog({ open: true, node: newNode, isNew: true, parentId });
  };

  const handleEditDepartment = (node) => {
    setEditDialog({ open: true, node: { ...node }, isNew: false });
  };

  const handleDeleteDepartment = (node) => {
    setDeleteDialog({ open: true, node });
  };

  const handleSaveDepartment = () => {
    const { node, isNew, parentId } = editDialog;
    
    if (isNew) {
      const newOrgData = { ...orgData };
      if (parentId) {
        const addToParent = (departments, parentId) => {
          return departments.map(dept => {
            if (dept.id === parentId) {
              return { ...dept, children: [...dept.children, node] };
            }
            if (dept.children) {
              return { ...dept, children: addToParent(dept.children, parentId) };
            }
            return dept;
          });
        };
        newOrgData.departments = addToParent(newOrgData.departments, parentId);
      } else {
        newOrgData.departments.push(node);
      }
      setOrgData(newOrgData);
      setSnackbar({ open: true, message: 'Department added successfully!', severity: 'success' });
    } else {
      const updateDepartment = (departments, nodeId, updatedNode) => {
        return departments.map(dept => {
          if (dept.id === nodeId) {
            return { ...dept, ...updatedNode };
          }
          if (dept.children) {
            return { ...dept, children: updateDepartment(dept.children, nodeId, updatedNode) };
          }
          return dept;
        });
      };
      const newOrgData = { ...orgData };
      newOrgData.departments = updateDepartment(newOrgData.departments, node.id, node);
      setOrgData(newOrgData);
      setSnackbar({ open: true, message: 'Department updated successfully!', severity: 'success' });
    }
    
    setEditDialog({ open: false, node: null, isNew: false });
  };

  const handleConfirmDelete = () => {
    const { node } = deleteDialog;
    
    const deleteDepartment = (departments, nodeId) => {
      return departments.filter(dept => {
        if (dept.id === nodeId) {
          return false;
        }
        if (dept.children) {
          dept.children = deleteDepartment(dept.children, nodeId);
        }
        return true;
      });
    };
    
    const newOrgData = { ...orgData };
    newOrgData.departments = deleteDepartment(newOrgData.departments, node.id);
    setOrgData(newOrgData);
    setDeleteDialog({ open: false, node: null });
    setSnackbar({ open: true, message: 'Department deleted successfully!', severity: 'success' });
  };

  const toggleFavorite = (nodeId) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(nodeId)) {
      newFavorites.delete(nodeId);
    } else {
      newFavorites.add(nodeId);
    }
    setFavorites(newFavorites);
  };

  const handleExport = (format) => {
    setSnackbar({ 
      open: true, 
      message: `Exporting organizational chart as ${format}...`, 
      severity: 'info' 
    });
    // Implement export functionality
  };

  const getIconComponent = (iconName) => {
    const icons = {
      Business: Business,
      Group: Group,
      Work: Work,
      School: School,
      AccountBalance: AccountBalance,
      Calculate: Calculate,
      TrendingUp: TrendingUpIcon,
      Engineering: Engineering,
      Factory: Factory,
      Verified: Verified
    };
    return icons[iconName] || Business;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const renderNode = useCallback((node, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const IconComponent = getIconComponent(node.icon);
    const isSelected = selectedNode?.id === node.id;
    const isFavorite = favorites.has(node.id);

    return (
      <Grow in={true} timeout={300 + depth * 100}>
        <Box key={node.id} sx={{ mb: 3, position: 'relative' }}>
          {/* Connection Lines */}
          {showConnectors && depth > 0 && (
            <Box
              sx={{
                position: 'absolute',
                left: -20,
                top: 0,
                bottom: 0,
                width: 3,
                background: `linear-gradient(to bottom, ${node.color}, ${node.color}88)`,
                borderRadius: 2,
                boxShadow: 1
              }}
            />
          )}
          
          <Card
            sx={{
              width: 350,
              cursor: 'pointer',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                boxShadow: 12,
                transform: 'translateY(-6px) scale(1.02)',
                '& .department-actions': {
                  opacity: 1
                },
                '& .department-details': {
                  opacity: 1,
                  transform: 'translateY(0)'
                }
              },
              border: isSelected ? `3px solid ${node.color}` : '1px solid',
              borderColor: isSelected ? node.color : 'divider',
              background: `linear-gradient(135deg, ${node.color}08, ${node.color}15, ${node.color}08)`,
              position: 'relative',
              overflow: 'visible',
              backdropFilter: 'blur(10px)',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `linear-gradient(45deg, transparent, ${node.color}05, transparent)`,
                opacity: 0,
                transition: 'opacity 0.3s ease',
                pointerEvents: 'none'
              },
              '&:hover::before': {
                opacity: 1
              }
            }}
            onClick={() => setSelectedNode(node)}
          >
            {/* Status Indicator */}
            <Box
              sx={{
                position: 'absolute',
                top: -3,
                right: -3,
                width: 16,
                height: 16,
                borderRadius: '50%',
                bgcolor: node.status === 'active' ? 'success.main' : 'warning.main',
                border: '3px solid white',
                boxShadow: 2,
                zIndex: 1
              }}
            />
            
            {/* Favorite Indicator */}
            <IconButton
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                zIndex: 1,
                color: isFavorite ? 'warning.main' : 'text.secondary',
                '&:hover': {
                  color: 'warning.main'
                }
              }}
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(node.id);
              }}
            >
              {isFavorite ? <Star /> : <StarBorder />}
            </IconButton>
            
            <CardContent sx={{ p: 3 }}>
              {/* Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Avatar 
                  sx={{ 
                    bgcolor: node.color, 
                    width: 56, 
                    height: 56,
                    boxShadow: 3,
                    border: '2px solid white'
                  }}
                >
                  <IconComponent />
                </Avatar>
                
                {/* Actions */}
                <Box 
                  className="department-actions"
                  sx={{ 
                    display: 'flex', 
                    gap: 0.5, 
                    opacity: editMode ? 1 : 0,
                    transition: 'opacity 0.3s ease'
                  }}
                >
                  <Tooltip title="View Details">
                    <IconButton 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDetails(true);
                      }}
                      sx={{ bgcolor: 'background.paper', boxShadow: 1 }}
                    >
                      <Visibility fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit Department">
                    <IconButton 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditDepartment(node);
                      }}
                      sx={{ bgcolor: 'background.paper', boxShadow: 1 }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Add Sub-department">
                    <IconButton 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddDepartment(node.id);
                      }}
                      sx={{ bgcolor: 'background.paper', boxShadow: 1 }}
                    >
                      <Add fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete Department">
                    <IconButton 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDepartment(node);
                      }}
                      sx={{ bgcolor: 'background.paper', boxShadow: 1 }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              
              {/* Department Info */}
              <Typography 
                variant="h6" 
                gutterBottom 
                sx={{ 
                  fontWeight: 700,
                  color: node.color,
                  textAlign: 'center',
                  textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}
              >
                {node.name}
              </Typography>
              
              <Typography 
                variant="body2" 
                color="text.secondary" 
                gutterBottom
                sx={{ textAlign: 'center', mb: 2, fontStyle: 'italic' }}
              >
                Manager: {node.manager}
              </Typography>
              
              {/* Employee Count */}
              {showEmployeeCount && (
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                  <Chip
                    label={`${node.employees} employees`}
                    size="small"
                    variant="outlined"
                    sx={{ 
                      borderColor: node.color,
                      color: node.color,
                      fontWeight: 600,
                      '&:hover': {
                        bgcolor: `${node.color}10`
                      }
                    }}
                  />
                </Box>
              )}
              
              {/* Budget Info */}
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Budget: {formatCurrency(node.budget)}
                </Typography>
              </Box>
              
              {/* Level Indicator */}
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={`Level ${node.level}`}
                  size="small"
                  variant="filled"
                  sx={{ 
                    bgcolor: `${node.color}20`,
                    color: node.color,
                    fontWeight: 500
                  }}
                />
                {hasChildren && (
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNode(node.id);
                    }}
                    sx={{ 
                      color: node.color,
                      '&:hover': { 
                        bgcolor: `${node.color}15`,
                        transform: 'scale(1.1)'
                      },
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Children */}
          {hasChildren && isExpanded && (
            <Slide direction="down" in={isExpanded} mountOnEnter unmountOnExit>
              <Box sx={{ ml: 8, mt: 3, position: 'relative' }}>
                {showConnectors && (
                  <Box
                    sx={{
                      position: 'absolute',
                      left: -20,
                      top: 0,
                      bottom: 0,
                      width: 3,
                      background: `linear-gradient(to bottom, ${node.color}88, ${node.color}44)`,
                      borderRadius: 2,
                      boxShadow: 1
                    }}
                  />
                )}
                <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {node.children.map(child => renderNode(child, depth + 1))}
                </Box>
              </Box>
            </Slide>
          )}
        </Box>
      </Grow>
    );
  }, [expandedNodes, selectedNode, editMode, showConnectors, showEmployeeCount, favorites]);

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
              Organizational Chart
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Visualize and manage your organizational structure with advanced features
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<Settings />}
              onClick={() => setEditMode(!editMode)}
              color={editMode ? 'primary' : 'inherit'}
            >
              {editMode ? 'Exit Edit Mode' : 'Edit Mode'}
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => handleAddDepartment()}
            >
              Add Department
            </Button>
          </Stack>
        </Box>

        {/* Enhanced Controls */}
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          {/* Search Row */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              placeholder="Search departments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              size="small"
            />
          </Box>
          
          {/* Controls Row */}
          <Grid container spacing={2} alignItems="center">
            {/* Zoom Controls */}
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" gutterBottom>
                Zoom Controls
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ZoomOut />}
                  onClick={handleZoomOut}
                  disabled={zoom <= 50}
                  sx={{ minWidth: 'auto', px: 1 }}
                >
                  Out
                </Button>
                <Typography variant="body2" sx={{ minWidth: 50, textAlign: 'center', fontWeight: 500 }}>
                  {zoom}%
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<ZoomIn />}
                  onClick={handleZoomIn}
                  disabled={zoom >= 200}
                  sx={{ minWidth: 'auto', px: 1 }}
                >
                  In
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleResetZoom}
                  sx={{ minWidth: 'auto', px: 1 }}
                >
                  Reset
                </Button>
              </Stack>
            </Grid>
            
            {/* Display Options */}
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" gutterBottom>
                Display Options
              </Typography>
              <Stack direction="column" spacing={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showConnectors}
                      onChange={(e) => setShowConnectors(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Connectors"
                  sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={showEmployeeCount}
                      onChange={(e) => setShowEmployeeCount(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Employee Count"
                  sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
                />
              </Stack>
            </Grid>
            
            {/* Animation Options */}
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" gutterBottom>
                Animation Options
              </Typography>
              <Stack direction="column" spacing={1}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={animations}
                      onChange={(e) => setAnimations(e.target.checked)}
                      size="small"
                    />
                  }
                  label="Animations"
                  sx={{ '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
                />
              </Stack>
            </Grid>
            
            {/* Quick Actions */}
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" gutterBottom>
                Quick Actions
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Refresh />}
                  onClick={handleResetZoom}
                  sx={{ minWidth: 'auto', px: 1 }}
                >
                  Reset View
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Fullscreen />}
                  onClick={() => setZoom(100)}
                  sx={{ minWidth: 'auto', px: 1 }}
                >
                  Fit View
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Paper>

        {/* Organizational Chart */}
        <Box
          ref={chartRef}
          sx={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top left',
            minHeight: '600px',
            p: 3,
            bgcolor: 'background.default',
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'auto',
            boxShadow: 3
          }}
        >
          {orgData.departments.map(department => renderNode(department))}
        </Box>

        {/* Selected Node Details */}
        {selectedNode && (
          <Fade in={true}>
            <Card sx={{ mt: 4, borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Department Details
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Department Name
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedNode.name}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Manager
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedNode.manager}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Employees
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedNode.employees}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary">
                      Budget
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {formatCurrency(selectedNode.budget)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Description
                    </Typography>
                    <Typography variant="body1" gutterBottom>
                      {selectedNode.description}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Fade>
        )}

        {/* Speed Dial for Quick Actions */}
        <SpeedDial
          ariaLabel="Quick actions"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          icon={<SpeedDialIcon />}
        >
          <SpeedDialAction
            icon={<PictureAsPdf />}
            tooltipTitle="Export as PDF"
            onClick={() => handleExport('PDF')}
          />
          <SpeedDialAction
            icon={<Image />}
            tooltipTitle="Export as Image"
            onClick={() => handleExport('Image')}
          />
          <SpeedDialAction
            icon={<TableChart />}
            tooltipTitle="Export as Excel"
            onClick={() => handleExport('Excel')}
          />
          <SpeedDialAction
            icon={<Print />}
            tooltipTitle="Print Chart"
            onClick={() => window.print()}
          />
        </SpeedDial>

        {/* Edit Department Dialog */}
        <Dialog
          open={editDialog.open}
          onClose={() => setEditDialog({ open: false, node: null, isNew: false })}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {editDialog.isNew ? 'Add New Department' : 'Edit Department'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Department Name"
                  value={editDialog.node?.name || ''}
                  onChange={(e) => setEditDialog({
                    ...editDialog,
                    node: { ...editDialog.node, name: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Manager"
                  value={editDialog.node?.manager || ''}
                  onChange={(e) => setEditDialog({
                    ...editDialog,
                    node: { ...editDialog.node, manager: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Number of Employees"
                  type="number"
                  value={editDialog.node?.employees || 0}
                  onChange={(e) => setEditDialog({
                    ...editDialog,
                    node: { ...editDialog.node, employees: parseInt(e.target.value) || 0 }
                  })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Budget"
                  type="number"
                  value={editDialog.node?.budget || 0}
                  onChange={(e) => setEditDialog({
                    ...editDialog,
                    node: { ...editDialog.node, budget: parseInt(e.target.value) || 0 }
                  })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Location"
                  value={editDialog.node?.location || ''}
                  onChange={(e) => setEditDialog({
                    ...editDialog,
                    node: { ...editDialog.node, location: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Phone"
                  value={editDialog.node?.phone || ''}
                  onChange={(e) => setEditDialog({
                    ...editDialog,
                    node: { ...editDialog.node, phone: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={editDialog.node?.email || ''}
                  onChange={(e) => setEditDialog({
                    ...editDialog,
                    node: { ...editDialog.node, email: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Website"
                  value={editDialog.node?.website || ''}
                  onChange={(e) => setEditDialog({
                    ...editDialog,
                    node: { ...editDialog.node, website: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  multiline
                  rows={3}
                  value={editDialog.node?.description || ''}
                  onChange={(e) => setEditDialog({
                    ...editDialog,
                    node: { ...editDialog.node, description: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={editDialog.node?.status || 'active'}
                    label="Status"
                    onChange={(e) => setEditDialog({
                      ...editDialog,
                      node: { ...editDialog.node, status: e.target.value }
                    })}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                    <MenuItem value="pending">Pending</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialog({ open: false, node: null, isNew: false })}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSaveDepartment}>
              {editDialog.isNew ? 'Add Department' : 'Save Changes'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialog.open}
          onClose={() => setDeleteDialog({ open: false, node: null })}
        >
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete "{deleteDialog.node?.name}"? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialog({ open: false, node: null })}>
              Cancel
            </Button>
            <Button variant="contained" color="error" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
        >
          <Alert onClose={handleSnackbarClose} severity={snackbar.severity}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </Container>
  );
};

export default OrganizationalChart; 