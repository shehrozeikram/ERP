import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Radio, TextField, Box, Typography } from '@mui/material';

const EvaluationTable = ({ 
  categories, 
  scores, 
  onScoreChange, 
  onCommentChange, 
  showDescription = false,
  subTotalLabel = 'Sub Total',
  subTotalMarks = 50
}) => {
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
          {categories.map((category) => (
            <TableRow key={category.name} hover>
              <TableCell>
                {showDescription && category.description ? (
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {category.name}:
                    </Typography>
                    <Typography variant="caption" color="textSecondary" sx={{ fontSize: '0.7rem' }}>
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
                  <Radio
                    checked={(scores?.[category.name]?.score || '') === mark.toString()}
                    onChange={(e) => onScoreChange(category.name, e.target.value)}
                    value={mark.toString()}
                    size="small"
                  />
                </TableCell>
              ))}
              <TableCell>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Comments"
                  value={scores?.[category.name]?.comments || ''}
                  onChange={(e) => onCommentChange(category.name, e.target.value)}
                />
              </TableCell>
            </TableRow>
          ))}
          <TableRow sx={{ bgcolor: 'grey.100', fontWeight: 700 }}>
            <TableCell sx={{ fontWeight: 700 }}>{subTotalLabel}</TableCell>
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

export default EvaluationTable;

