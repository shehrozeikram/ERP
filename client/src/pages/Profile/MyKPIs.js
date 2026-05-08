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
  LinearProgress
} from '@mui/material';
import { Assignment as AssignmentIcon, Star as StarIcon } from '@mui/icons-material';
import api from '../../services/api';
import toast from 'react-hot-toast';
import moment from 'moment';

const MyKPIs = () => {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeEval, setActiveEval] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);

  const fetchEvaluations = async () => {
    try {
      const response = await api.get('/kpi/evaluations/my');
      setEvaluations(response.data.data);
    } catch (error) {
      toast.error('Failed to load your evaluations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvaluations();
  }, []);

  const handleOpenAssessment = (evaluation) => {
    setActiveEval(JSON.parse(JSON.stringify(evaluation))); // Deep copy
    setOpenDialog(true);
  };

  const handleScoreChange = (index, value) => {
    const updatedEval = { ...activeEval };
    updatedEval.kpiItems[index].selfScore = Number(value);
    setActiveEval(updatedEval);
  };

  const handleCommentChange = (index, value) => {
    const updatedEval = { ...activeEval };
    updatedEval.kpiItems[index].selfComment = value;
    setActiveEval(updatedEval);
  };

  const handleSubmitSelfAssessment = async () => {
    try {
      // Validate
      const incomplete = activeEval.kpiItems.some(i => i.selfScore === undefined || i.selfScore === null);
      if (incomplete) {
        toast.error('Please provide a self-score for all items');
        return;
      }

      await api.put(`/kpi/evaluations/${activeEval._id}`, {
        kpiItems: activeEval.kpiItems,
        status: 'self_submitted'
      });
      
      toast.success('Self-assessment submitted successfully!');
      setOpenDialog(false);
      fetchEvaluations();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error submitting assessment');
    }
  };

  if (loading) return <LinearProgress />;

  return (
    <Box sx={{ maxWidth: 1000, margin: 'auto', p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4, gap: 2 }}>
        <StarIcon color="primary" sx={{ fontSize: 32 }} />
        <Typography variant="h4" fontWeight="bold">My Performance Evaluations</Typography>
      </Box>

      <Grid container spacing={3}>
        {evaluations.map((evaluation) => (
          <Grid item xs={12} key={evaluation._id}>
            <Card sx={{ borderLeft: `4px solid ${evaluation.status === 'draft' ? '#f59e0b' : evaluation.status === 'completed' ? '#10b981' : '#3b82f6'}` }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">{evaluation.cycle?.title || 'Evaluation Cycle'}</Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      Period: {moment(evaluation.cycle?.period?.startDate).format('MMM D, YYYY')} - {moment(evaluation.cycle?.period?.endDate).format('MMM D, YYYY')}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      <Chip 
                        label={evaluation.status.replace('_', ' ')} 
                        color={
                          evaluation.status === 'draft' ? 'warning' : 
                          evaluation.status === 'self_submitted' ? 'info' : 
                          evaluation.status === 'under_review' ? 'primary' : 'success'
                        } 
                        size="small" 
                        sx={{ textTransform: 'capitalize' }}
                      />
                      {evaluation.status === 'completed' && (
                        <Chip label={`Final Score: ${evaluation.finalWeightedScore}%`} color="success" size="small" />
                      )}
                    </Box>
                  </Box>

                  <Box>
                    {evaluation.status === 'draft' && (
                      <Button variant="contained" onClick={() => handleOpenAssessment(evaluation)}>
                        Start Self-Assessment
                      </Button>
                    )}
                    {evaluation.status !== 'draft' && (
                      <Button variant="outlined" onClick={() => handleOpenAssessment(evaluation)}>
                        View Details
                      </Button>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
        {evaluations.length === 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <AssignmentIcon sx={{ fontSize: 60, color: 'text.secondary', opacity: 0.5, mb: 2 }} />
                <Typography variant="h6" color="textSecondary">No Evaluations Found</Typography>
                <Typography variant="body2" color="textSecondary">You are not part of any active evaluation cycles.</Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* ASSESSMENT DIALOG */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        {activeEval && (
          <>
            <DialogTitle>
              {activeEval.status === 'draft' ? 'Complete Self-Assessment' : 'Evaluation Details'}
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>{activeEval.cycle?.title}</Typography>
              <Divider sx={{ mb: 3 }} />

              {activeEval.kpiItems.map((item, index) => (
                <Card key={item._id || index} sx={{ mb: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }} elevation={0}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6" color="primary.main">{item.title}</Typography>
                      <Chip label={`Weight: ${item.weight}%`} size="small" />
                    </Box>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                      {item.description || 'No description provided.'}
                    </Typography>

                    <Grid container spacing={3}>
                      <Grid item xs={12} md={4}>
                        <TextField
                          fullWidth
                          label={`Your Score ${item.measurementType === 'rating_1_to_5' ? '(1-5)' : '(0-100)'}`}
                          type="number"
                          InputProps={{ inputProps: { min: 0, max: item.measurementType === 'rating_1_to_5' ? 5 : 100 } }}
                          value={item.selfScore || ''}
                          onChange={(e) => handleScoreChange(index, e.target.value)}
                          disabled={activeEval.status !== 'draft'}
                          required
                        />
                      </Grid>
                      <Grid item xs={12} md={8}>
                        <TextField
                          fullWidth
                          label="Your Comments / Justification"
                          multiline
                          rows={2}
                          value={item.selfComment || ''}
                          onChange={(e) => handleCommentChange(index, e.target.value)}
                          disabled={activeEval.status !== 'draft'}
                        />
                      </Grid>

                      {/* Show Manager Review if completed */}
                      {(activeEval.status === 'completed' || activeEval.status === 'under_review') && item.evaluatorScore !== undefined && (
                        <Grid item xs={12}>
                          <Box sx={{ p: 2, bgcolor: '#eff6ff', borderRadius: 1, borderLeft: '4px solid #3b82f6', mt: 1 }}>
                            <Typography variant="subtitle2" fontWeight="bold">Manager Review</Typography>
                            <Typography variant="body1">Score: <strong>{item.evaluatorScore}</strong></Typography>
                            {item.evaluatorComment && (
                              <Typography variant="body2" sx={{ mt: 1 }}>"{item.evaluatorComment}"</Typography>
                            )}
                          </Box>
                        </Grid>
                      )}
                    </Grid>
                  </CardContent>
                </Card>
              ))}

              {activeEval.hrRemarks && (
                <Box sx={{ mt: 3, p: 2, bgcolor: '#fef2f2', borderRadius: 1, borderLeft: '4px solid #ef4444' }}>
                  <Typography variant="subtitle2" fontWeight="bold">HR / Final Remarks</Typography>
                  <Typography variant="body2">{activeEval.hrRemarks}</Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenDialog(false)}>Close</Button>
              {activeEval.status === 'draft' && (
                <Button variant="contained" onClick={handleSubmitSelfAssessment} color="primary">
                  Submit Final Assessment
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default MyKPIs;
