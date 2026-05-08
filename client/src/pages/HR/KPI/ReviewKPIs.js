import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
  Avatar
} from '@mui/material';
import { AssignmentTurnedIn as ReviewIcon, Person as PersonIcon } from '@mui/icons-material';
import api from '../../../services/api';
import toast from 'react-hot-toast';
import moment from 'moment';

const ReviewKPIs = () => {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeEval, setActiveEval] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);

  const fetchTeamEvaluations = async () => {
    try {
      // In a real app, this endpoint filters evaluations where the logged-in user is the manager
      const response = await api.get('/kpi/evaluations/review');
      setEvaluations(response.data.data);
    } catch (error) {
      toast.error('Failed to load team evaluations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamEvaluations();
  }, []);

  const handleOpenReview = (evaluation) => {
    setActiveEval(JSON.parse(JSON.stringify(evaluation))); // Deep copy
    setOpenDialog(true);
  };

  const handleScoreChange = (index, value) => {
    const updatedEval = { ...activeEval };
    updatedEval.kpiItems[index].evaluatorScore = Number(value);
    setActiveEval(updatedEval);
  };

  const handleCommentChange = (index, value) => {
    const updatedEval = { ...activeEval };
    updatedEval.kpiItems[index].evaluatorComment = value;
    setActiveEval(updatedEval);
  };

  const handleSubmitReview = async () => {
    try {
      // Validate
      const incomplete = activeEval.kpiItems.some(i => i.evaluatorScore === undefined || i.evaluatorScore === null);
      if (incomplete) {
        toast.error('Please provide a final manager score for all items');
        return;
      }

      await api.put(`/kpi/evaluations/${activeEval._id}`, {
        kpiItems: activeEval.kpiItems,
        status: 'completed', // Manager sets it to completed
        hrRemarks: activeEval.hrRemarks || '' // Manager can also add overall remarks
      });
      
      toast.success('Manager review submitted successfully!');
      setOpenDialog(false);
      fetchTeamEvaluations();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error submitting review');
    }
  };

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, gap: 2 }}>
        <ReviewIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h5" fontWeight="bold">Manager Review: Team Evaluations</Typography>
      </Box>

      <Grid container spacing={3}>
        {evaluations.map((evaluation) => (
          <Grid item xs={12} sm={6} md={4} key={evaluation._id}>
            <Card sx={{ borderTop: `4px solid ${evaluation.status === 'self_submitted' ? '#f59e0b' : '#10b981'}` }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Avatar><PersonIcon /></Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {evaluation.employee?.firstName} {evaluation.employee?.lastName}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {evaluation.employee?.position || 'Employee'}
                    </Typography>
                  </Box>
                </Box>
                
                <Divider sx={{ mb: 2 }} />
                
                <Typography variant="body2" sx={{ mb: 1 }}><strong>Cycle:</strong> {evaluation.cycle?.title}</Typography>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                  <Chip 
                    label={evaluation.status === 'self_submitted' ? 'Needs Review' : 'Completed'} 
                    color={evaluation.status === 'self_submitted' ? 'warning' : 'success'} 
                    size="small" 
                  />
                  <Button variant="outlined" size="small" onClick={() => handleOpenReview(evaluation)}>
                    {evaluation.status === 'self_submitted' ? 'Review Now' : 'View Result'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
        {evaluations.length === 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <Typography variant="h6" color="textSecondary">No Evaluations Pending Review</Typography>
                <Typography variant="body2" color="textSecondary">Your team has no pending evaluations at this time.</Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* REVIEW DIALOG */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        {activeEval && (
          <>
            <DialogTitle>
              Reviewing: {activeEval.employee?.firstName} {activeEval.employee?.lastName}
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, bgcolor: '#f1f5f9', p: 2, borderRadius: 1 }}>
                <Typography variant="subtitle1"><strong>Cycle:</strong> {activeEval.cycle?.title}</Typography>
                <Typography variant="subtitle1"><strong>Template:</strong> {activeEval.template?.title}</Typography>
              </Box>

              {activeEval.kpiItems.map((item, index) => (
                <Card key={item._id || index} sx={{ mb: 3 }} variant="outlined">
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6" color="primary.main">{item.title}</Typography>
                      <Chip label={`Weight: ${item.weight}%`} size="small" />
                    </Box>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>{item.description}</Typography>

                    {/* Employee's Self Assessment */}
                    <Box sx={{ p: 2, bgcolor: '#fef3c7', borderRadius: 1, borderLeft: '4px solid #f59e0b', mb: 3 }}>
                      <Typography variant="subtitle2" fontWeight="bold">Employee's Self-Assessment</Typography>
                      <Typography variant="body1" sx={{ mt: 1 }}>Score: <strong>{item.selfScore !== undefined ? item.selfScore : 'Not provided'}</strong></Typography>
                      {item.selfComment && (
                        <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>"{item.selfComment}"</Typography>
                      )}
                    </Box>

                    {/* Manager's Review */}
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          label={`Your Final Score ${item.measurementType === 'rating_1_to_5' ? '(1-5)' : '(0-100)'}`}
                          type="number"
                          InputProps={{ inputProps: { min: 0, max: item.measurementType === 'rating_1_to_5' ? 5 : 100 } }}
                          value={item.evaluatorScore || ''}
                          onChange={(e) => handleScoreChange(index, e.target.value)}
                          disabled={activeEval.status === 'completed'}
                          required
                          focused
                        />
                      </Grid>
                      <Grid item xs={12} md={8}>
                        <TextField
                          fullWidth
                          label="Your Comments / Justification"
                          multiline
                          rows={2}
                          value={item.evaluatorComment || ''}
                          onChange={(e) => handleCommentChange(index, e.target.value)}
                          disabled={activeEval.status === 'completed'}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
              
              <TextField
                fullWidth
                label="Overall Manager Remarks"
                multiline
                rows={3}
                value={activeEval.hrRemarks || ''}
                onChange={(e) => setActiveEval({...activeEval, hrRemarks: e.target.value})}
                disabled={activeEval.status === 'completed'}
                sx={{ mt: 2 }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
              {activeEval.status === 'self_submitted' && (
                <Button variant="contained" onClick={handleSubmitReview} color="primary">
                  Submit Final Evaluation
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default ReviewKPIs;
