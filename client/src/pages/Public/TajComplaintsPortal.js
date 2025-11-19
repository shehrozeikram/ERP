import React from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  CardActions,
  Stack
} from '@mui/material';
import ForumIcon from '@mui/icons-material/Forum';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import { useNavigate } from 'react-router-dom';

const OptionCard = ({ title, description, icon, actionLabel, onClick, disabled }) => (
  <Card
    elevation={4}
    sx={{
      borderRadius: 4,
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}
  >
    <CardContent sx={{ flexGrow: 1 }}>
      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        {icon}
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </CardContent>
    <CardActions sx={{ p: 2, pt: 0 }}>
      <Button
        variant="contained"
        color="primary"
        fullWidth
        disabled={disabled}
        onClick={onClick}
      >
        {actionLabel}
      </Button>
    </CardActions>
  </Card>
);

const TajComplaintsPortal = () => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: '#f4f7fb',
        py: { xs: 6, md: 10 }
      }}
    >
      <Container maxWidth="md">
        <Box textAlign="center" mb={5}>
          <Typography variant="h3" fontWeight={800} gutterBottom>
            Taj Residencia Support Portal
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Submit and track society complaints anytime. Choose an option below to get started.
          </Typography>
        </Box>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <OptionCard
              title="Register Complaint"
              description="Share a new issue related to infrastructure, security, utilities, or plot management. Our support team will review and respond promptly."
              icon={<ForumIcon color="primary" sx={{ fontSize: 40 }} />}
              actionLabel="Register Complaint"
              onClick={() => navigate('/taj-complaints/register')}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <OptionCard
              title="My Complains"
              description="Track status updates, responses, and resolutions for every complaint you have submitted in the past."
              icon={<AssignmentTurnedInIcon color="success" sx={{ fontSize: 40 }} />}
              actionLabel="Track My Complaints"
              onClick={() => navigate('/taj-complaints/my')}
            />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default TajComplaintsPortal;

