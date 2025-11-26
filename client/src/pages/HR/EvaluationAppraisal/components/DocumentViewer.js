import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Grid,
  Divider,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  Close as CloseIcon,
  Print as PrintIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import dayjs from 'dayjs';
import MarksDescriptionSection from './MarksDescriptionSection';
import {
  evaluationCategories,
  whiteCollarProfessionalAttributes,
  whiteCollarPersonalAttributes,
  overallResultOptions
} from '../constants';

// Read-only evaluation table component
const ReadOnlyEvaluationTable = ({ categories, scores, subTotalMarks = 50, showDescription = false }) => {
  const calculateSubTotal = () => {
    if (!scores) return 0;
    return Object.values(scores).reduce((sum, item) => {
      return sum + (parseInt(item?.score) || 0);
    }, 0);
  };

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'primary.main' }}>
            <TableCell sx={{ color: 'white', fontWeight: 600, minWidth: showDescription ? 200 : 'auto' }}>
              Category
            </TableCell>
            <TableCell align="center" sx={{ color: 'white', fontWeight: 600 }}>
              Total {showDescription ? 'Score' : 'Marks'}
            </TableCell>
            <TableCell align="center" sx={{ color: 'white', fontWeight: 600 }}>1</TableCell>
            <TableCell align="center" sx={{ color: 'white', fontWeight: 600 }}>2</TableCell>
            <TableCell align="center" sx={{ color: 'white', fontWeight: 600 }}>3</TableCell>
            <TableCell align="center" sx={{ color: 'white', fontWeight: 600 }}>4</TableCell>
            <TableCell align="center" sx={{ color: 'white', fontWeight: 600 }}>5</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 600 }}>Comments</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {categories.map((category) => {
            const score = scores?.[category.name]?.score || '';
            return (
              <TableRow key={category.name} hover>
                <TableCell>
                  {showDescription && category.description ? (
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {category.name}:
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                        {category.description}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {category.name}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="center">{category.totalMarks}</TableCell>
                {[1, 2, 3, 4, 5].map((mark) => (
                  <TableCell align="center" key={mark}>
                    {score === mark.toString() ? '✓' : ''}
                  </TableCell>
                ))}
                <TableCell>
                  <Typography variant="body2" color="text.secondary">
                    {scores?.[category.name]?.comments || '-'}
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow sx={{ bgcolor: 'grey.100', fontWeight: 700 }}>
            <TableCell sx={{ fontWeight: 700 }}>Total Score</TableCell>
            <TableCell align="center" sx={{ fontWeight: 700 }}>{subTotalMarks}</TableCell>
            <TableCell colSpan={6} align="right" sx={{ fontWeight: 700 }}>
              <Typography variant="body2">
                Obtained: <strong>{calculateSubTotal()}</strong> / {subTotalMarks}
              </Typography>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const DocumentViewer = ({ open, document, onClose }) => {
  if (!document) return null;

  const getStatusColor = (status) => {
    const colors = {
      draft: 'default',
      sent: 'info',
      in_progress: 'warning',
      submitted: 'primary',
      completed: 'success',
      archived: 'secondary'
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const isBlueCollar = document.formType === 'blue_collar';

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // TODO: Implement download functionality
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '80vh' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Evaluation Document - {document.employee?.firstName} {document.employee?.lastName}
          </Typography>
          <Box display="flex" gap={1}>
            <Chip
              label={getStatusLabel(document.status)}
              size="small"
              color={getStatusColor(document.status)}
            />
            <Button
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              size="small"
            >
              Print
            </Button>
            <Button
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              size="small"
            >
              Download
            </Button>
            <Button
              onClick={onClose}
              size="small"
            >
              <CloseIcon />
            </Button>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        <Paper sx={{ p: 3 }}>
          {/* Employee Information */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
              Employee Information
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <Typography variant="body2" color="text.secondary">Code</Typography>
                <Typography variant="body1">{document.code || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="body2" color="text.secondary">Date</Typography>
                <Typography variant="body1">
                  {document.date ? dayjs(document.date).format('YYYY-MM-DD') : 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Name</Typography>
                <Typography variant="body1">{document.name || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Review Period</Typography>
                <Typography variant="body1">
                  {document.reviewPeriodFrom && document.reviewPeriodTo
                    ? `${dayjs(document.reviewPeriodFrom).format('DD MMM YYYY')} to ${dayjs(document.reviewPeriodTo).format('DD MMM YYYY')}`
                    : 'N/A'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Designation</Typography>
                <Typography variant="body1">{document.designation || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Department/Section</Typography>
                <Typography variant="body1">{document.department?.name || 'N/A'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary">Immediate Boss / Evaluator</Typography>
                <Typography variant="body1">{document.immediateBoss || 'N/A'}</Typography>
              </Grid>
              {document.appraisalHistory && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Appraisal History</Typography>
                  <Typography variant="body1">{document.appraisalHistory}</Typography>
                </Grid>
              )}
            </Grid>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Marks Description */}
          <MarksDescriptionSection />

          <Divider sx={{ my: 3 }} />

          {/* Overall Result */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'primary.main' }}>
              OVERALL RESULT (Description)
            </Typography>
            <Box display="flex" gap={2} flexWrap="wrap">
              {overallResultOptions.map((option) => (
                <Chip
                  key={option.value}
                  label={`${option.label} (${option.percentage})`}
                  color={document.overallResult === option.value ? 'primary' : 'default'}
                  variant={document.overallResult === option.value ? 'filled' : 'outlined'}
                />
              ))}
            </Box>
            {document.totalScore !== undefined && document.percentage !== undefined && (
              <Box mt={2}>
                <Typography variant="body2" color="text.secondary">
                  Total Score: <strong>{document.totalScore}</strong> | Percentage: <strong>{document.percentage}%</strong>
                </Typography>
              </Box>
            )}
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Evaluation Table */}
          {isBlueCollar ? (
            <ReadOnlyEvaluationTable
              categories={evaluationCategories}
              scores={document.evaluationScores || {}}
              subTotalMarks={50}
            />
          ) : (
            <>
              <Typography variant="h6" gutterBottom>
                Professional Attributes
              </Typography>
              <ReadOnlyEvaluationTable
                categories={whiteCollarProfessionalAttributes}
                scores={document.whiteCollarProfessionalScores || {}}
                subTotalMarks={50}
                showDescription
              />
              <Box mt={3}>
                <Typography variant="h6" gutterBottom>
                  Personal Attributes
                </Typography>
                <ReadOnlyEvaluationTable
                  categories={whiteCollarPersonalAttributes}
                  scores={document.whiteCollarPersonalScores || {}}
                  subTotalMarks={50}
                  showDescription
                />
              </Box>
            </>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Comments Section */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom>
                Strength
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {document.strength || 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom>
                Weakness
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {document.weakness || 'N/A'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" gutterBottom>
                Other Comments
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {document.otherComments || 'N/A'}
              </Typography>
            </Grid>
          </Grid>

          {/* White Collar Additional Fields */}
          {!isBlueCollar && (
            <>
              <Divider sx={{ my: 3 }} />
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Reporting Officer Comments
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {document.reportingOfficerComments || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Counter Signing Officer Comments
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {document.counterSigningOfficerComments || 'N/A'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" gutterBottom>
                    Development Plan
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {document.developmentPlan || 'N/A'}
                  </Typography>
                </Grid>
              </Grid>
            </>
          )}
        </Paper>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default DocumentViewer;
