import React, { useState, useEffect, useCallback } from 'react';
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
  AccordionDetails,
  Rating,
  Slider,
  Checkbox,
  FormGroup,
  Radio,
  RadioGroup,
  FormLabel
} from '@mui/material';
import {
  Work,
  Add,
  Edit,
  Delete,
  Visibility,
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
  SupervisorAccount,
  Engineering,
  Factory,
  Calculate,
  TrendingUp as TrendingUpIcon,
  Verified,
  AccountBalance,
  School,
  Business,
  Group,
  Psychology,
  School as SchoolIcon,
  WorkOutline,
  Assignment,
  Description,
  ListAlt,
  CheckCircleOutline,
  RadioButtonUnchecked,
  ExpandMore,
  ExpandLess,
  MoreVert,
  Settings,
  Refresh,
  Save,
  Cancel,
  Print,
  Fullscreen,
  ZoomIn,
  ZoomOut,
  ArrowBack
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';

const JobAnalysis = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  
  const [jobAnalyses, setJobAnalyses] = useState([
    {
      id: 1,
      title: 'Software Engineer',
      department: 'Engineering',
      level: 'Mid-Level',
      status: 'active',
      priority: 'high',
      createdAt: '2024-01-15',
      lastUpdated: '2024-01-20',
      createdBy: 'HR Manager',
      description: 'Develop and maintain software applications using modern technologies',
      requirements: {
        education: 'Bachelor\'s in Computer Science',
        experience: '3-5 years',
        skills: ['JavaScript', 'React', 'Node.js', 'Python', 'SQL'],
        certifications: ['AWS Certified Developer', 'Scrum Master'],
        softSkills: ['Communication', 'Teamwork', 'Problem Solving']
      },
      responsibilities: [
        'Develop and maintain web applications',
        'Collaborate with cross-functional teams',
        'Write clean, maintainable code',
        'Participate in code reviews',
        'Debug and fix software issues'
      ],
      evaluation: {
        technicalSkills: 4.5,
        communication: 4.0,
        problemSolving: 4.2,
        teamwork: 4.3,
        leadership: 3.8
      },
      compensation: {
        min: 80000,
        max: 120000,
        currency: 'USD',
        benefits: ['Health Insurance', '401k', 'Stock Options', 'Flexible Hours']
      },
      workload: {
        hoursPerWeek: 40,
        travel: '10%',
        remote: true,
        overtime: 'Occasional'
      }
    },
    {
      id: 2,
      title: 'Marketing Manager',
      department: 'Marketing',
      level: 'Senior',
      status: 'active',
      priority: 'medium',
      createdAt: '2024-01-10',
      lastUpdated: '2024-01-18',
      createdBy: 'HR Director',
      description: 'Lead marketing initiatives and develop strategic campaigns',
      requirements: {
        education: 'Bachelor\'s in Marketing or Business',
        experience: '5-7 years',
        skills: ['Digital Marketing', 'SEO', 'Social Media', 'Analytics', 'Strategy'],
        certifications: ['Google Analytics', 'HubSpot Marketing'],
        softSkills: ['Leadership', 'Creativity', 'Analytical Thinking']
      },
      responsibilities: [
        'Develop and execute marketing strategies',
        'Manage marketing campaigns',
        'Analyze market trends and competition',
        'Lead marketing team',
        'Track and report on KPIs'
      ],
      evaluation: {
        technicalSkills: 4.0,
        communication: 4.5,
        problemSolving: 4.1,
        teamwork: 4.4,
        leadership: 4.6
      },
      compensation: {
        min: 70000,
        max: 100000,
        currency: 'USD',
        benefits: ['Health Insurance', '401k', 'Performance Bonus', 'Professional Development']
      },
      workload: {
        hoursPerWeek: 45,
        travel: '20%',
        remote: 'Hybrid',
        overtime: 'Regular'
      }
    }
  ]);

  const [selectedJob, setSelectedJob] = useState(null);
  const [editDialog, setEditDialog] = useState({ open: false, job: null, isNew: false });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, job: null });
  const [viewMode, setViewMode] = useState('grid'); // grid, list, detail
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('title');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [activeTab, setActiveTab] = useState(0);

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleAddJob = () => {
    const newJob = {
      id: Date.now(),
      title: '',
      department: '',
      level: 'Entry',
      status: 'draft',
      priority: 'medium',
      createdAt: new Date().toISOString().split('T')[0],
      lastUpdated: new Date().toISOString().split('T')[0],
      createdBy: 'Current User',
      description: '',
      requirements: {
        education: '',
        experience: '',
        skills: [],
        certifications: [],
        softSkills: []
      },
      responsibilities: [],
      evaluation: {
        technicalSkills: 3.0,
        communication: 3.0,
        problemSolving: 3.0,
        teamwork: 3.0,
        leadership: 3.0
      },
      compensation: {
        min: 0,
        max: 0,
        currency: 'USD',
        benefits: []
      },
      workload: {
        hoursPerWeek: 40,
        travel: '0%',
        remote: false,
        overtime: 'None'
      }
    };
    setEditDialog({ open: true, job: newJob, isNew: true });
  };

  const handleEditJob = (job) => {
    setEditDialog({ open: true, job: { ...job }, isNew: false });
  };

  const handleDeleteJob = (job) => {
    setDeleteDialog({ open: true, job });
  };

  const handleSaveJob = () => {
    const { job, isNew } = editDialog;
    
    if (isNew) {
      setJobAnalyses(prev => [...prev, job]);
      setSnackbar({ open: true, message: 'Job analysis created successfully!', severity: 'success' });
    } else {
      setJobAnalyses(prev => prev.map(j => j.id === job.id ? job : j));
      setSnackbar({ open: true, message: 'Job analysis updated successfully!', severity: 'success' });
    }
    
    setEditDialog({ open: false, job: null, isNew: false });
  };

  const handleConfirmDelete = () => {
    const { job } = deleteDialog;
    setJobAnalyses(prev => prev.filter(j => j.id !== job.id));
    setDeleteDialog({ open: false, job: null });
    setSnackbar({ open: true, message: 'Job analysis deleted successfully!', severity: 'success' });
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'success',
      draft: 'warning',
      inactive: 'error',
      pending: 'info'
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      high: 'error',
      medium: 'warning',
      low: 'success'
    };
    return colors[priority] || 'default';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const renderJobCard = (job) => (
    <Grow in={true} timeout={300}>
      <Card
        sx={{
          height: '100%',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          '&:hover': {
            boxShadow: 8,
            transform: 'translateY(-4px)'
          },
          border: selectedJob?.id === job.id ? `2px solid ${theme.palette.primary.main}` : '1px solid',
          borderColor: selectedJob?.id === job.id ? 'primary.main' : 'divider'
        }}
        onClick={() => setSelectedJob(job)}
      >
        <CardContent sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                {job.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {job.department} • {job.level}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                label={job.status}
                size="small"
                color={getStatusColor(job.status)}
                variant="outlined"
              />
              <Chip
                label={job.priority}
                size="small"
                color={getPriorityColor(job.priority)}
                variant="outlined"
              />
            </Box>
          </Box>

          {/* Description */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.5 }}>
            {job.description}
          </Typography>

          {/* Requirements Preview */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Requirements:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {job.requirements.skills.slice(0, 3).map((skill, index) => (
                <Chip
                  key={index}
                  label={skill}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              ))}
              {job.requirements.skills.length > 3 && (
                <Chip
                  label={`+${job.requirements.skills.length - 3} more`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              )}
            </Box>
          </Box>

          {/* Compensation */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Compensation: {formatCurrency(job.compensation.min)} - {formatCurrency(job.compensation.max)}
            </Typography>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Updated: {job.lastUpdated}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="View Details">
                <IconButton size="small" onClick={(e) => {
                  e.stopPropagation();
                  setSelectedJob(job);
                  setViewMode('detail');
                }}>
                  <Visibility fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit Job Analysis">
                <IconButton size="small" onClick={(e) => {
                  e.stopPropagation();
                  handleEditJob(job);
                }}>
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete Job Analysis">
                <IconButton size="small" onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteJob(job);
                }}>
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Grow>
  );

  const renderJobDetail = (job) => (
    <Fade in={true}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
            <Tab label="Overview" />
            <Tab label="Requirements" />
            <Tab label="Responsibilities" />
            <Tab label="Evaluation" />
            <Tab label="Compensation" />
            <Tab label="Workload" />
          </Tabs>

          {activeTab === 0 && (
            <Box>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                {job.title}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {job.description}
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Department
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {job.department}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Level
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {job.level}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Status
                  </Typography>
                  <Chip label={job.status} color={getStatusColor(job.status)} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Priority
                  </Typography>
                  <Chip label={job.priority} color={getPriorityColor(job.priority)} />
                </Grid>
              </Grid>
            </Box>
          )}

          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Job Requirements
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Education
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {job.requirements.education}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Experience
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {job.requirements.experience}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Technical Skills
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {job.requirements.skills.map((skill, index) => (
                      <Chip key={index} label={skill} variant="outlined" />
                    ))}
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Certifications
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {job.requirements.certifications.map((cert, index) => (
                      <Chip key={index} label={cert} variant="outlined" color="primary" />
                    ))}
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Soft Skills
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {job.requirements.softSkills.map((skill, index) => (
                      <Chip key={index} label={skill} variant="outlined" color="secondary" />
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}

          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Job Responsibilities
              </Typography>
              <List>
                {job.responsibilities.map((responsibility, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemIcon>
                      <CheckCircleOutline color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={responsibility} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {activeTab === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Evaluation Criteria
              </Typography>
              
              <Grid container spacing={3}>
                {Object.entries(job.evaluation).map(([skill, rating]) => (
                  <Grid item xs={12} md={6} key={skill}>
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                          {skill.replace(/([A-Z])/g, ' $1').trim()}
                        </Typography>
                        <Typography variant="body2" color="primary">
                          {rating}/5
                        </Typography>
                      </Box>
                      <Rating value={rating} readOnly precision={0.1} />
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {activeTab === 4 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Compensation & Benefits
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Salary Range
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {formatCurrency(job.compensation.min)} - {formatCurrency(job.compensation.max)}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Currency
                  </Typography>
                  <Typography variant="body1">
                    {job.compensation.currency}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Benefits
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {job.compensation.benefits.map((benefit, index) => (
                      <Chip key={index} label={benefit} variant="outlined" color="success" />
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}

          {activeTab === 5 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Workload & Schedule
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Hours per Week
                  </Typography>
                  <Typography variant="body1">
                    {job.workload.hoursPerWeek} hours
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Travel Requirements
                  </Typography>
                  <Typography variant="body1">
                    {job.workload.travel}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Remote Work
                  </Typography>
                  <Typography variant="body1">
                    {job.workload.remote ? 'Yes' : 'No'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Overtime
                  </Typography>
                  <Typography variant="body1">
                    {job.workload.overtime}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </CardContent>
      </Card>
    </Fade>
  );

  return (
    <Container maxWidth="xl">
      <Box sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
              Job Analysis
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Create, manage, and analyze job descriptions and requirements
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              startIcon={<ViewModule />}
              onClick={() => setViewMode('grid')}
              color={viewMode === 'grid' ? 'primary' : 'inherit'}
            >
              Grid
            </Button>
            <Button
              variant="outlined"
              startIcon={<ViewList />}
              onClick={() => setViewMode('list')}
              color={viewMode === 'list' ? 'primary' : 'inherit'}
            >
              List
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleAddJob}
            >
              Create Job Analysis
            </Button>
          </Stack>
        </Box>

        {/* Controls */}
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                placeholder="Search job analyses..."
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
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Department</InputLabel>
                <Select
                  value={filterDepartment}
                  label="Department"
                  onChange={(e) => setFilterDepartment(e.target.value)}
                >
                  <MenuItem value="all">All Departments</MenuItem>
                  <MenuItem value="Engineering">Engineering</MenuItem>
                  <MenuItem value="Marketing">Marketing</MenuItem>
                  <MenuItem value="Sales">Sales</MenuItem>
                  <MenuItem value="HR">HR</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Level</InputLabel>
                <Select
                  value={filterLevel}
                  label="Level"
                  onChange={(e) => setFilterLevel(e.target.value)}
                >
                  <MenuItem value="all">All Levels</MenuItem>
                  <MenuItem value="Entry">Entry</MenuItem>
                  <MenuItem value="Mid-Level">Mid-Level</MenuItem>
                  <MenuItem value="Senior">Senior</MenuItem>
                  <MenuItem value="Lead">Lead</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterStatus}
                  label="Status"
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort By"
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <MenuItem value="title">Title</MenuItem>
                  <MenuItem value="department">Department</MenuItem>
                  <MenuItem value="createdAt">Created Date</MenuItem>
                  <MenuItem value="priority">Priority</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Content */}
        {viewMode === 'detail' && selectedJob ? (
          <Box>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => setViewMode('grid')}
              sx={{ mb: 2 }}
            >
              Back to List
            </Button>
            {renderJobDetail(selectedJob)}
          </Box>
        ) : (
          <Grid container spacing={3}>
            {jobAnalyses.map(job => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={job.id}>
                {renderJobCard(job)}
              </Grid>
            ))}
          </Grid>
        )}

        {/* Speed Dial */}
        <SpeedDial
          ariaLabel="Quick actions"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          icon={<SpeedDialIcon />}
        >
          <SpeedDialAction
            icon={<PictureAsPdf />}
            tooltipTitle="Export as PDF"
            onClick={() => setSnackbar({ open: true, message: 'Exporting as PDF...', severity: 'info' })}
          />
          <SpeedDialAction
            icon={<TableChart />}
            tooltipTitle="Export as Excel"
            onClick={() => setSnackbar({ open: true, message: 'Exporting as Excel...', severity: 'info' })}
          />
          <SpeedDialAction
            icon={<Print />}
            tooltipTitle="Print"
            onClick={() => window.print()}
          />
        </SpeedDial>

        {/* Edit Dialog */}
        <Dialog
          open={editDialog.open}
          onClose={() => setEditDialog({ open: false, job: null, isNew: false })}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {editDialog.isNew ? 'Create New Job Analysis' : 'Edit Job Analysis'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Job Title"
                  value={editDialog.job?.title || ''}
                  onChange={(e) => setEditDialog({
                    ...editDialog,
                    job: { ...editDialog.job, title: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Department"
                  value={editDialog.job?.department || ''}
                  onChange={(e) => setEditDialog({
                    ...editDialog,
                    job: { ...editDialog.job, department: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Level</InputLabel>
                  <Select
                    value={editDialog.job?.level || 'Entry'}
                    label="Level"
                    onChange={(e) => setEditDialog({
                      ...editDialog,
                      job: { ...editDialog.job, level: e.target.value }
                    })}
                  >
                    <MenuItem value="Entry">Entry</MenuItem>
                    <MenuItem value="Mid-Level">Mid-Level</MenuItem>
                    <MenuItem value="Senior">Senior</MenuItem>
                    <MenuItem value="Lead">Lead</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={editDialog.job?.priority || 'medium'}
                    label="Priority"
                    onChange={(e) => setEditDialog({
                      ...editDialog,
                      job: { ...editDialog.job, priority: e.target.value }
                    })}
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Job Description"
                  multiline
                  rows={3}
                  value={editDialog.job?.description || ''}
                  onChange={(e) => setEditDialog({
                    ...editDialog,
                    job: { ...editDialog.job, description: e.target.value }
                  })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialog({ open: false, job: null, isNew: false })}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSaveJob}>
              {editDialog.isNew ? 'Create' : 'Save Changes'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog
          open={deleteDialog.open}
          onClose={() => setDeleteDialog({ open: false, job: null })}
        >
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete "{deleteDialog.job?.title}"? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialog({ open: false, job: null })}>
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

export default JobAnalysis; 