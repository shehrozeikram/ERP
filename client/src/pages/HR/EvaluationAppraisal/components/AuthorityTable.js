import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  Card,
  CardContent,
  Link,
  Box
} from '@mui/material';
import {
  Email as EmailIcon
} from '@mui/icons-material';

const AuthorityTable = ({ employees, searchTerm, label }) => {
  if (employees.length === 0) {
    return (
      <Card>
        <CardContent sx={{ textAlign: 'center', py: 5 }}>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            {searchTerm ? `No ${label}s found matching your search` : `No ${label}s found`}
          </Typography>
          <Typography variant="body2" color="textSecondary">
            {searchTerm
              ? 'Try adjusting your search criteria'
              : `There are no employees with ${label} designation in the system`}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: 'primary.main' }}>
            <TableCell sx={{ color: 'white', fontWeight: 600 }}>Employee ID</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 600 }}>Name</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 600 }}>Email</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 600 }}>Designation</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 600 }}>Department</TableCell>
            <TableCell sx={{ color: 'white', fontWeight: 600 }}>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {employees.map((employee) => (
            <TableRow key={employee._id} hover>
              <TableCell>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {employee.employeeId || 'N/A'}
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {employee.firstName} {employee.lastName}
                </Typography>
              </TableCell>
              <TableCell>
                {employee.email ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <EmailIcon fontSize="small" color="action" />
                    <Link
                      href={`mailto:${employee.email}`}
                      variant="body2"
                      sx={{ textDecoration: 'none', color: 'primary.main' }}
                    >
                      {employee.email}
                    </Link>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    N/A
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <Chip
                  label={employee.placementDesignation?.title ||
                    employee.placementDesignation ||
                    employee.designation ||
                    'N/A'}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </TableCell>
              <TableCell>
                <Chip
                  label={employee.placementDepartment?.name ||
                    employee.placementDepartment ||
                    'N/A'}
                  size="small"
                  color="secondary"
                  variant="outlined"
                />
              </TableCell>
              <TableCell>
                <Chip
                  label={employee.isActive !== false ? 'Active' : 'Inactive'}
                  size="small"
                  color={employee.isActive !== false ? 'success' : 'default'}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default AuthorityTable;

