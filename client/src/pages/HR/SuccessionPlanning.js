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
  FormLabel,

} from '@mui/material';
import {
  TrendingUp,
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
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
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
  Person,
  PersonAdd,
  PersonRemove,
  GroupAdd,
  Leaderboard,
  EmojiEvents,
  School as EducationIcon,
  Work as WorkIcon,
  Assessment as AssessmentIcon,
  TrendingUp as GrowthIcon,
  CalendarToday,
  Event,
  EventAvailable,
  EventBusy,
  Schedule as ScheduleIcon,
  Timeline as TimelineIcon2,
  ArrowForward,
  ArrowBack,
  ArrowUpward,
  ArrowDownward,
  TrendingFlat,
  TrendingDown,
  StarBorder,
  StarHalf,
  Grade,
  MilitaryTech,
  EmojiEvents as TrophyIcon,
  Psychology as PsychologyIcon,
  School as TrainingIcon,
  Work as ExperienceIcon,
  Assessment as SkillsIcon,
  TrendingUp as PotentialIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';

const SuccessionPlanning = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  
  const [successionPlans, setSuccessionPlans] = useState([
    {
      id: 1,
      position: 'Chief Technology Officer',
      department: 'Engineering',
      currentIncumbent: 'John Smith',
      status: 'active',
      priority: 'high',
      riskLevel: 'medium',
      timeline: '12-18 months',
      createdAt: '2024-01-15',
      lastUpdated: '2024-01-20',
      createdBy: 'HR Director',
      description: 'Succession plan for CTO position with focus on technical leadership',
      candidates: [
        {
          id: 1,
          name: 'Sarah Johnson',
          currentPosition: 'Senior Engineering Manager',
          department: 'Engineering',
          readiness: 85,
          potential: 90,
          experience: '8 years',
          skills: ['Technical Leadership', 'Team Management', 'Architecture', 'Strategy'],
          strengths: ['Strong technical background', 'Excellent communication', 'Strategic thinking'],
          developmentAreas: ['Executive presence', 'Board experience'],
          timeline: '12 months',
          status: 'ready',
          assessments: {
            technicalSkills: 4.5,
            leadership: 4.2,
            communication: 4.0,
            strategicThinking: 4.3,
            businessAcumen: 3.8
          },
          developmentPlan: [
            'Executive coaching program',
            'Board observer role',
            'Strategic project leadership',
            'External networking'
          ]
        },
        {
          id: 2,
          name: 'Michael Chen',
          currentPosition: 'VP of Engineering',
          department: 'Engineering',
          readiness: 75,
          potential: 85,
          experience: '10 years',
          skills: ['Engineering Management', 'Product Strategy', 'Team Building', 'Innovation'],
          strengths: ['Proven track record', 'Innovation mindset', 'Team development'],
          developmentAreas: ['Financial acumen', 'External stakeholder management'],
          timeline: '18 months',
          status: 'developing',
          assessments: {
            technicalSkills: 4.3,
            leadership: 4.5,
            communication: 4.1,
            strategicThinking: 4.0,
            businessAcumen: 3.5
          },
          developmentPlan: [
            'Financial management training',
            'Customer-facing projects',
            'Industry conference speaking',
            'Mentorship program'
          ]
        }
      ],
      requirements: {
        technicalSkills: 4.5,
        leadership: 4.8,
        communication: 4.5,
        strategicThinking: 4.7,
        businessAcumen: 4.3
      },
      developmentPrograms: [
        'Executive Leadership Program',
        'Board Governance Training',
        'Strategic Planning Workshop',
        'Industry Networking Events'
      ],
      milestones: [
        {
          id: 1,
          title: 'Assessment Complete',
          date: '2024-02-15',
          status: 'completed',
          description: 'Initial candidate assessments completed'
        },
        {
          id: 2,
          title: 'Development Plan Approval',
          date: '2024-03-01',
          status: 'in-progress',
          description: 'Individual development plans approved'
        },
        {
          id: 3,
          title: 'Executive Coaching Start',
          date: '2024-03-15',
          status: 'pending',
          description: 'Executive coaching program begins'
        },
        {
          id: 4,
          title: 'Board Observer Role',
          date: '2024-06-01',
          status: 'pending',
          description: 'Candidates begin board observer roles'
        }
      ]
    },
    {
      id: 2,
      position: 'Marketing Director',
      department: 'Marketing',
      currentIncumbent: 'Lisa Rodriguez',
      status: 'active',
      priority: 'medium',
      riskLevel: 'low',
      timeline: '6-12 months',
      createdAt: '2024-01-10',
      lastUpdated: '2024-01-18',
      createdBy: 'HR Manager',
      description: 'Succession planning for Marketing Director with focus on digital transformation',
      candidates: [
        {
          id: 3,
          name: 'David Kim',
          currentPosition: 'Senior Marketing Manager',
          department: 'Marketing',
          readiness: 90,
          potential: 85,
          experience: '6 years',
          skills: ['Digital Marketing', 'Brand Strategy', 'Team Leadership', 'Analytics'],
          strengths: ['Digital expertise', 'Data-driven approach', 'Creative thinking'],
          developmentAreas: ['Budget management', 'Cross-functional leadership'],
          timeline: '6 months',
          status: 'ready',
          assessments: {
            technicalSkills: 4.7,
            leadership: 4.0,
            communication: 4.5,
            strategicThinking: 4.2,
            businessAcumen: 3.9
          },
          developmentPlan: [
            'Budget management training',
            'Cross-functional project leadership',
            'Executive presentation skills',
            'Industry thought leadership'
          ]
        }
      ],
      requirements: {
        technicalSkills: 4.3,
        leadership: 4.5,
        communication: 4.7,
        strategicThinking: 4.4,
        businessAcumen: 4.0
      },
      developmentPrograms: [
        'Digital Marketing Leadership',
        'Brand Strategy Workshop',
        'Executive Communication',
        'Business Acumen Training'
      ],
      milestones: [
        {
          id: 1,
          title: 'Candidate Assessment',
          date: '2024-02-01',
          status: 'completed',
          description: 'Initial candidate assessment completed'
        },
        {
          id: 2,
          title: 'Development Plan',
          date: '2024-02-15',
          status: 'in-progress',
          description: 'Development plan creation and approval'
        }
      ]
    }
  ]);

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [editDialog, setEditDialog] = useState({ open: false, plan: null, isNew: false });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, plan: null });
  const [viewMode, setViewMode] = useState('grid'); // grid, list, detail
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [sortBy, setSortBy] = useState('position');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [activeTab, setActiveTab] = useState(0);

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const handleAddPlan = () => {
    const newPlan = {
      id: Date.now(),
      position: '',
      department: '',
      currentIncumbent: '',
      status: 'draft',
      priority: 'medium',
      riskLevel: 'medium',
      timeline: '12-18 months',
      createdAt: new Date().toISOString().split('T')[0],
      lastUpdated: new Date().toISOString().split('T')[0],
      createdBy: 'Current User',
      description: '',
      candidates: [],
      requirements: {
        technicalSkills: 3.0,
        leadership: 3.0,
        communication: 3.0,
        strategicThinking: 3.0,
        businessAcumen: 3.0
      },
      developmentPrograms: [],
      milestones: []
    };
    setEditDialog({ open: true, plan: newPlan, isNew: true });
  };

  const handleEditPlan = (plan) => {
    setEditDialog({ open: true, plan: { ...plan }, isNew: false });
  };

  const handleDeletePlan = (plan) => {
    setDeleteDialog({ open: true, plan });
  };

  const handleSavePlan = () => {
    const { plan, isNew } = editDialog;
    
    if (isNew) {
      setSuccessionPlans(prev => [...prev, plan]);
      setSnackbar({ open: true, message: 'Succession plan created successfully!', severity: 'success' });
    } else {
      setSuccessionPlans(prev => prev.map(p => p.id === plan.id ? plan : p));
      setSnackbar({ open: true, message: 'Succession plan updated successfully!', severity: 'success' });
    }
    
    setEditDialog({ open: false, plan: null, isNew: false });
  };

  const handleConfirmDelete = () => {
    const { plan } = deleteDialog;
    setSuccessionPlans(prev => prev.filter(p => p.id !== plan.id));
    setDeleteDialog({ open: false, plan: null });
    setSnackbar({ open: true, message: 'Succession plan deleted successfully!', severity: 'success' });
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

  const getRiskColor = (risk) => {
    const colors = {
      high: 'error',
      medium: 'warning',
      low: 'success'
    };
    return colors[risk] || 'default';
  };

  const getReadinessColor = (readiness) => {
    if (readiness >= 80) return 'success';
    if (readiness >= 60) return 'warning';
    return 'error';
  };

  const renderPlanCard = (plan) => (
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
          border: selectedPlan?.id === plan.id ? `2px solid ${theme.palette.primary.main}` : '1px solid',
          borderColor: selectedPlan?.id === plan.id ? 'primary.main' : 'divider'
        }}
        onClick={() => setSelectedPlan(plan)}
      >
        <CardContent sx={{ p: 3 }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                {plan.position}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {plan.department} • {plan.currentIncumbent}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                label={plan.status}
                size="small"
                color={getStatusColor(plan.status)}
                variant="outlined"
              />
              <Chip
                label={plan.priority}
                size="small"
                color={getPriorityColor(plan.priority)}
                variant="outlined"
              />
            </Box>
          </Box>

          {/* Description */}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.5 }}>
            {plan.description}
          </Typography>

          {/* Risk Level */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Risk Level:
            </Typography>
            <Chip
              label={plan.riskLevel}
              size="small"
              color={getRiskColor(plan.riskLevel)}
              variant="outlined"
              sx={{ ml: 1 }}
            />
          </Box>

          {/* Candidates */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Candidates: {plan.candidates.length}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
              {plan.candidates.slice(0, 2).map((candidate, index) => (
                <Chip
                  key={index}
                  label={`${candidate.name} (${candidate.readiness}%)`}
                  size="small"
                  variant="outlined"
                  color={getReadinessColor(candidate.readiness)}
                  sx={{ fontSize: '0.7rem' }}
                />
              ))}
              {plan.candidates.length > 2 && (
                <Chip
                  label={`+${plan.candidates.length - 2} more`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              )}
            </Box>
          </Box>

          {/* Timeline */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Timeline: {plan.timeline}
            </Typography>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              Updated: {plan.lastUpdated}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="View Details">
                <IconButton size="small" onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPlan(plan);
                  setViewMode('detail');
                }}>
                  <Visibility fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit Succession Plan">
                <IconButton size="small" onClick={(e) => {
                  e.stopPropagation();
                  handleEditPlan(plan);
                }}>
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete Succession Plan">
                <IconButton size="small" onClick={(e) => {
                  e.stopPropagation();
                  handleDeletePlan(plan);
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

  const renderPlanDetail = (plan) => (
    <Fade in={true}>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
            <Tab label="Overview" />
            <Tab label="Candidates" />
            <Tab label="Requirements" />
            <Tab label="Development" />
            <Tab label="Timeline" />
          </Tabs>

          {activeTab === 0 && (
            <Box>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
                {plan.position}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {plan.description}
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Department
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {plan.department}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Current Incumbent
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {plan.currentIncumbent}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" gutterBottom>
                    Status
                  </Typography>
                  <Chip label={plan.status} color={getStatusColor(plan.status)} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" gutterBottom>
                    Priority
                  </Typography>
                  <Chip label={plan.priority} color={getPriorityColor(plan.priority)} />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="subtitle2" gutterBottom>
                    Risk Level
                  </Typography>
                  <Chip label={plan.riskLevel} color={getRiskColor(plan.riskLevel)} />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Timeline
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {plan.timeline}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>
                    Candidates
                  </Typography>
                  <Typography variant="body1" gutterBottom>
                    {plan.candidates.length} candidates identified
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}

          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Succession Candidates
              </Typography>
              
              {plan.candidates.map((candidate, index) => (
                <Card key={candidate.id} sx={{ mb: 3, p: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={8}>
                      <Typography variant="h6" gutterBottom>
                        {candidate.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {candidate.currentPosition} • {candidate.experience} experience
                      </Typography>
                      
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Skills:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                          {candidate.skills.map((skill, idx) => (
                            <Chip key={idx} label={skill} size="small" variant="outlined" />
                          ))}
                        </Box>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" color={getReadinessColor(candidate.readiness)}>
                          {candidate.readiness}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Readiness
                        </Typography>
                        <Typography variant="h6" color="primary">
                          {candidate.potential}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Potential
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Development Plan:
                    </Typography>
                    <List dense>
                      {candidate.developmentPlan.map((item, idx) => (
                        <ListItem key={idx} sx={{ px: 0 }}>
                          <ListItemIcon>
                            <CheckCircleOutline color="primary" />
                          </ListItemIcon>
                          <ListItemText primary={item} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </Card>
              ))}
            </Box>
          )}

          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Position Requirements
              </Typography>
              
              <Grid container spacing={3}>
                {Object.entries(plan.requirements).map(([skill, rating]) => (
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

          {activeTab === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Development Programs
              </Typography>
              
              <List>
                {plan.developmentPrograms.map((program, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemIcon>
                      <School color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={program} />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {activeTab === 4 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Implementation Timeline
              </Typography>
              
              <Box sx={{ position: 'relative' }}>
                {plan.milestones.map((milestone, index) => (
                  <Box key={milestone.id} sx={{ display: 'flex', mb: 3 }}>
                    {/* Timeline Line */}
                    <Box sx={{ 
                      position: 'relative',
                      width: 60,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      {/* Timeline Dot */}
                      <Box sx={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        bgcolor: milestone.status === 'completed' ? 'success.main' : 
                                milestone.status === 'in-progress' ? 'primary.main' : 'grey.400',
                        border: 2,
                        borderColor: 'white',
                        boxShadow: 2,
                        zIndex: 2
                      }} />
                      
                      {/* Timeline Connector */}
                      {index < plan.milestones.length - 1 && (
                        <Box sx={{
                          width: 2,
                          height: 60,
                          bgcolor: 'grey.300',
                          mt: 1
                        }} />
                      )}
                    </Box>
                    
                    {/* Content */}
                    <Box sx={{ flex: 1, ml: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="h6" component="span">
                          {milestone.title}
                        </Typography>
                        <Chip 
                          label={milestone.status} 
                          size="small"
                          color={milestone.status === 'completed' ? 'success' : 
                                 milestone.status === 'in-progress' ? 'primary' : 'default'}
                          variant="outlined"
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {milestone.date}
                      </Typography>
                      <Typography variant="body1">
                        {milestone.description}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
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
              Succession Planning
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Develop and manage leadership succession plans and talent pipelines
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
              onClick={handleAddPlan}
            >
              Create Succession Plan
            </Button>
          </Stack>
        </Box>

        {/* Controls */}
        <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                placeholder="Search succession plans..."
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
                <InputLabel>Priority</InputLabel>
                <Select
                  value={filterPriority}
                  label="Priority"
                  onChange={(e) => setFilterPriority(e.target.value)}
                >
                  <MenuItem value="all">All Priorities</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="low">Low</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortBy}
                  label="Sort By"
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <MenuItem value="position">Position</MenuItem>
                  <MenuItem value="department">Department</MenuItem>
                  <MenuItem value="priority">Priority</MenuItem>
                  <MenuItem value="riskLevel">Risk Level</MenuItem>
                  <MenuItem value="createdAt">Created Date</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Content */}
        {viewMode === 'detail' && selectedPlan ? (
          <Box>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => setViewMode('grid')}
              sx={{ mb: 2 }}
            >
              Back to List
            </Button>
            {renderPlanDetail(selectedPlan)}
          </Box>
        ) : (
          <Grid container spacing={3}>
            {successionPlans.map(plan => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={plan.id}>
                {renderPlanCard(plan)}
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
          onClose={() => setEditDialog({ open: false, plan: null, isNew: false })}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            {editDialog.isNew ? 'Create New Succession Plan' : 'Edit Succession Plan'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Position"
                  value={editDialog.plan?.position || ''}
                  onChange={(e) => setEditDialog({
                    ...editDialog,
                    plan: { ...editDialog.plan, position: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Department"
                  value={editDialog.plan?.department || ''}
                  onChange={(e) => setEditDialog({
                    ...editDialog,
                    plan: { ...editDialog.plan, department: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Current Incumbent"
                  value={editDialog.plan?.currentIncumbent || ''}
                  onChange={(e) => setEditDialog({
                    ...editDialog,
                    plan: { ...editDialog.plan, currentIncumbent: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={editDialog.plan?.priority || 'medium'}
                    label="Priority"
                    onChange={(e) => setEditDialog({
                      ...editDialog,
                      plan: { ...editDialog.plan, priority: e.target.value }
                    })}
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Risk Level</InputLabel>
                  <Select
                    value={editDialog.plan?.riskLevel || 'medium'}
                    label="Risk Level"
                    onChange={(e) => setEditDialog({
                      ...editDialog,
                      plan: { ...editDialog.plan, riskLevel: e.target.value }
                    })}
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Timeline"
                  value={editDialog.plan?.timeline || ''}
                  onChange={(e) => setEditDialog({
                    ...editDialog,
                    plan: { ...editDialog.plan, timeline: e.target.value }
                  })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  multiline
                  rows={3}
                  value={editDialog.plan?.description || ''}
                  onChange={(e) => setEditDialog({
                    ...editDialog,
                    plan: { ...editDialog.plan, description: e.target.value }
                  })}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialog({ open: false, plan: null, isNew: false })}>
              Cancel
            </Button>
            <Button variant="contained" onClick={handleSavePlan}>
              {editDialog.isNew ? 'Create' : 'Save Changes'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog
          open={deleteDialog.open}
          onClose={() => setDeleteDialog({ open: false, plan: null })}
        >
          <DialogTitle>Confirm Delete</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete "{deleteDialog.plan?.position}"? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialog({ open: false, plan: null })}>
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

export default SuccessionPlanning; 