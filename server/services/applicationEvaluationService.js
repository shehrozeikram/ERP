const mongoose = require('mongoose');
const JobPosting = require('../models/hr/JobPosting');
const Application = require('../models/hr/Application');
const EmailService = require('./emailService');

class ApplicationEvaluationService {
  // Evaluate application against job requirements
  async evaluateApplication(applicationId) {
    try {
      const application = await Application.findById(applicationId)
        .populate('jobPosting')
        .populate('evaluation.evaluatedBy');

      if (!application || !application.jobPosting) {
        throw new Error('Application or job posting not found');
      }

      const jobPosting = application.jobPosting;
      const evaluation = {
        requirementsMatch: 0,
        experienceMatch: 0,
        skillsMatch: 0,
        overallScore: 0,
        isShortlisted: false,
        shortlistReason: '',
        evaluationNotes: '',
        evaluatedAt: new Date()
      };

      // Evaluate requirements match
      evaluation.requirementsMatch = this.evaluateRequirements(application, jobPosting);
      
      // Evaluate experience match
      evaluation.experienceMatch = this.evaluateExperience(application, jobPosting);
      
      // Evaluate skills match
      evaluation.skillsMatch = this.evaluateSkills(application, jobPosting);
      
      // Ensure all scores are valid numbers
      evaluation.requirementsMatch = isNaN(evaluation.requirementsMatch) ? 0 : Math.max(0, Math.min(100, evaluation.requirementsMatch));
      evaluation.experienceMatch = isNaN(evaluation.experienceMatch) ? 0 : Math.max(0, Math.min(100, evaluation.experienceMatch));
      evaluation.skillsMatch = isNaN(evaluation.skillsMatch) ? 0 : Math.max(0, Math.min(100, evaluation.skillsMatch));
      
      // Calculate overall score
      evaluation.overallScore = Math.round(
        (evaluation.requirementsMatch * 0.4) +
        (evaluation.experienceMatch * 0.35) +
        (evaluation.skillsMatch * 0.25)
      );
      
      // Ensure overall score is valid
      evaluation.overallScore = isNaN(evaluation.overallScore) ? 0 : Math.max(0, Math.min(100, evaluation.overallScore));

      // Determine if shortlisted
      evaluation.isShortlisted = evaluation.overallScore >= 70;
      
      if (evaluation.isShortlisted) {
        evaluation.shortlistReason = 'Meets minimum requirements and has strong match with job criteria';
      } else {
        evaluation.shortlistReason = 'Does not meet minimum requirements or has low match with job criteria';
      }

      // Generate evaluation notes
      evaluation.evaluationNotes = this.generateEvaluationNotes(application, jobPosting, evaluation);

      // Update application with evaluation results
      application.evaluation = evaluation;
      await application.save();

      // If shortlisted, create candidate record and send email
      if (evaluation.isShortlisted) {
        const candidate = await this.createCandidateFromApplication(application);
        
        // Send shortlist notification email
        try {
          await EmailService.sendShortlistNotification(candidate, jobPosting, application);
        } catch (emailError) {
          console.error('Error sending shortlist email:', emailError.message);
          // Don't fail the evaluation if email fails
        }
      }

      return {
        success: true,
        evaluation: evaluation,
        message: evaluation.isShortlisted ? 'Application shortlisted!' : 'Application evaluated'
      };

    } catch (error) {
      console.error('Application evaluation error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Evaluate requirements match
  evaluateRequirements(application, jobPosting) {
    let score = 0;
    const requirements = jobPosting.requirements.toLowerCase();
    const candidateInfo = this.getCandidateInfo(application).toLowerCase();

    // Check education level
    if (application.education?.highestEducation) {
      const education = application.education.highestEducation.toLowerCase();
      if (requirements.includes('bachelor') && education.includes('bachelor')) score += 20;
      if (requirements.includes('master') && education.includes('master')) score += 20;
      if (requirements.includes('phd') && education.includes('phd')) score += 20;
    }

    // Check for required keywords
    const requiredKeywords = this.extractKeywords(requirements);
    const candidateKeywords = this.extractKeywords(candidateInfo);
    
    const matchedKeywords = requiredKeywords.filter(keyword => 
      candidateKeywords.includes(keyword)
    );
    
    // Avoid division by zero
    if (requiredKeywords.length > 0) {
      score += (matchedKeywords.length / requiredKeywords.length) * 40;
    } else {
      // If no specific keywords found, give a base score
      score += 20;
    }

    // Check certifications
    if (application.skills?.certifications) {
      const certifications = application.skills.certifications.toLowerCase();
      if (requirements.includes('certification') && certifications.length > 0) score += 20;
    }

    return Math.min(score, 100);
  }

  // Evaluate experience match
  evaluateExperience(application, jobPosting) {
    let score = 0;
    
    // Check years of experience
    if (application.professionalInfo?.yearsOfExperience) {
      const experience = parseInt(application.professionalInfo.yearsOfExperience) || 0;
      const requiredExperience = this.extractExperienceLevel(jobPosting.experienceLevel);
      
      if (experience >= requiredExperience) {
        score += 40;
      } else if (experience >= requiredExperience * 0.7) {
        score += 25;
      } else if (experience >= requiredExperience * 0.5) {
        score += 15;
      }
    }

    // Check current position relevance
    if (application.professionalInfo?.currentPosition) {
      const currentPosition = application.professionalInfo.currentPosition.toLowerCase();
      const jobTitle = jobPosting.title.toLowerCase();
      
      if (this.isPositionRelevant(currentPosition, jobTitle)) {
        score += 30;
      } else if (this.isPositionSomewhatRelevant(currentPosition, jobTitle)) {
        score += 15;
      }
    }

    // Check industry experience
    if (application.professionalInfo?.currentCompany) {
      score += 15; // Basic score for having work experience
    }

    // Check availability
    if (application.availability === 'immediate' || application.availability === '2_weeks') {
      score += 15;
    } else if (application.availability === '1_month') {
      score += 10;
    }

    return Math.min(score, 100);
  }

  // Evaluate skills match
  evaluateSkills(application, jobPosting) {
    let score = 0;
    
    if (!application.skills?.technicalSkills) {
      return score;
    }

    const candidateSkills = application.skills.technicalSkills.toLowerCase();
    const jobRequirements = jobPosting.requirements.toLowerCase();
    
    // Extract technical skills from job requirements
    const requiredSkills = this.extractTechnicalSkills(jobRequirements);
    const candidateSkillList = this.extractTechnicalSkills(candidateSkills);
    
    // Calculate skills match
    const matchedSkills = requiredSkills.filter(skill => 
      candidateSkillList.includes(skill)
    );
    
    score = (matchedSkills.length / requiredSkills.length) * 80;
    
    // Bonus for additional relevant skills
    const additionalSkills = candidateSkillList.filter(skill => 
      !requiredSkills.includes(skill) && this.isRelevantSkill(skill, jobRequirements)
    );
    
    score += Math.min(additionalSkills.length * 5, 20);

    return Math.min(score, 100);
  }

  // Helper methods
  getCandidateInfo(application) {
    const info = [];
    
    if (application.personalInfo) {
      info.push(application.personalInfo.firstName, application.personalInfo.lastName);
    }
    
    if (application.professionalInfo) {
      info.push(application.professionalInfo.currentPosition, application.professionalInfo.currentCompany);
    }
    
    if (application.education) {
      info.push(application.education.highestEducation, application.education.institution);
    }
    
    if (application.skills) {
      info.push(application.skills.technicalSkills, application.skills.certifications);
    }
    
    if (application.additionalInfo) {
      info.push(application.additionalInfo.whyJoinUs);
    }
    
    return info.join(' ');
  }

  extractKeywords(text) {
    const commonKeywords = [
      'javascript', 'python', 'java', 'react', 'node.js', 'sql', 'mongodb',
      'aws', 'docker', 'kubernetes', 'git', 'agile', 'scrum', 'leadership',
      'management', 'communication', 'teamwork', 'problem solving', 'analytics',
      'marketing', 'sales', 'finance', 'hr', 'operations', 'design', 'ui/ux'
    ];
    
    return commonKeywords.filter(keyword => text.includes(keyword));
  }

  extractExperienceLevel(level) {
    const experienceMap = {
      'entry': 0,
      'junior': 1,
      'mid': 3,
      'senior': 5,
      'lead': 7,
      'manager': 8,
      'director': 10,
      'executive': 12
    };
    
    return experienceMap[level] || 0;
  }

  isPositionRelevant(currentPosition, jobTitle) {
    const relevantKeywords = ['developer', 'engineer', 'manager', 'analyst', 'specialist'];
    return relevantKeywords.some(keyword => 
      currentPosition.includes(keyword) && jobTitle.includes(keyword)
    );
  }

  isPositionSomewhatRelevant(currentPosition, jobTitle) {
    const techKeywords = ['tech', 'software', 'it', 'digital', 'web'];
    const businessKeywords = ['business', 'operations', 'management', 'strategy'];
    
    const isTech = techKeywords.some(keyword => 
      currentPosition.includes(keyword) || jobTitle.includes(keyword)
    );
    
    const isBusiness = businessKeywords.some(keyword => 
      currentPosition.includes(keyword) || jobTitle.includes(keyword)
    );
    
    return isTech || isBusiness;
  }

  extractTechnicalSkills(text) {
    const skills = [
      'javascript', 'python', 'java', 'c++', 'c#', 'php', 'ruby', 'go', 'rust',
      'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask', 'spring',
      'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'git',
      'html', 'css', 'sass', 'less', 'typescript', 'webpack', 'babel',
      'machine learning', 'ai', 'data science', 'statistics', 'r', 'matlab'
    ];
    
    return skills.filter(skill => text.includes(skill));
  }

  isRelevantSkill(skill, jobRequirements) {
    const relevantSkills = this.extractTechnicalSkills(jobRequirements);
    return relevantSkills.some(requiredSkill => 
      skill.includes(requiredSkill) || requiredSkill.includes(skill)
    );
  }

  generateEvaluationNotes(application, jobPosting, evaluation) {
    const notes = [];
    
    notes.push(`Overall Score: ${evaluation.overallScore}/100`);
    notes.push(`Requirements Match: ${evaluation.requirementsMatch}/100`);
    notes.push(`Experience Match: ${evaluation.experienceMatch}/100`);
    notes.push(`Skills Match: ${evaluation.skillsMatch}/100`);
    
    if (evaluation.isShortlisted) {
      notes.push('✅ SHORTLISTED - Meets minimum requirements');
    } else {
      notes.push('❌ NOT SHORTLISTED - Does not meet minimum requirements');
    }
    
    // Add specific feedback
    if (evaluation.requirementsMatch < 50) {
      notes.push('⚠️ Low requirements match - may need additional qualifications');
    }
    
    if (evaluation.experienceMatch < 50) {
      notes.push('⚠️ Limited relevant experience - consider for junior role');
    }
    
    if (evaluation.skillsMatch < 50) {
      notes.push('⚠️ Skills gap identified - may need training');
    }
    
    return notes.join('\n');
  }

  // Create candidate record from shortlisted application
  async createCandidateFromApplication(application) {
    try {
      const Candidate = require('../models/hr/Candidate');
      
      // Check if candidate already exists
      const existingCandidate = await Candidate.findOne({
        email: application.personalInfo?.email
      });
      
      if (existingCandidate) {
        return existingCandidate;
      }
      
      // Parse notice period to number
      const parseNoticePeriod = (noticePeriod) => {
        if (!noticePeriod) return 30;
        const match = noticePeriod.toString().match(/(\d+)/);
        return match ? parseInt(match[1]) : 30;
      };
      
      // Parse years of experience to number
      const parseYearsOfExperience = (years) => {
        if (!years) return 0;
        const match = years.toString().match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
      };
      
      // Parse skills string to array of skill objects
      const parseSkills = (skillsString) => {
        if (!skillsString) return [];
        return skillsString.split(',').map(skill => ({
          name: skill.trim(),
          level: 'intermediate',
          yearsOfExperience: 0
        }));
      };
      
      // Parse certifications string to array of certification objects
      const parseCertifications = (certString) => {
        if (!certString) return [];
        return certString.split(',').map(cert => ({
          name: cert.trim(),
          issuingOrganization: 'Unknown',
          issueDate: new Date(),
          credentialId: ''
        }));
      };
      
      // Parse languages string to array of language objects
      const parseLanguages = (langString) => {
        if (!langString) return [];
        return langString.split(',').map(lang => {
          const langMatch = lang.match(/(\w+)\s*\((\w+)\)/);
          let language = langMatch ? langMatch[1].trim() : lang.trim();
          let proficiency = langMatch ? langMatch[2].toLowerCase() : 'conversational';
          
          // Map proficiency levels to valid enum values
          const proficiencyMap = {
            'basic': 'basic',
            'intermediate': 'conversational',
            'conversational': 'conversational',
            'fluent': 'fluent',
            'native': 'native',
            'good': 'fluent',
            'excellent': 'fluent'
          };
          
          proficiency = proficiencyMap[proficiency] || 'conversational';
          return { language, proficiency };
        });
      };
      
      // Create new candidate
      const candidateData = {
        firstName: application.personalInfo?.firstName || '',
        lastName: application.personalInfo?.lastName || '',
        email: application.personalInfo?.email || '',
        phone: application.personalInfo?.phone || '',
        dateOfBirth: application.personalInfo?.dateOfBirth || new Date('1990-01-01'),
        gender: application.personalInfo?.gender || 'other',
        nationality: application.personalInfo?.country || 'Pakistan',
        
        // Address
        address: {
          street: application.personalInfo?.address || '',
          city: application.personalInfo?.city || '',
          country: application.personalInfo?.country || 'Pakistan'
        },
        
        // Professional info
        currentPosition: application.professionalInfo?.currentPosition || '',
        currentCompany: application.professionalInfo?.currentCompany || '',
        yearsOfExperience: parseYearsOfExperience(application.professionalInfo?.yearsOfExperience),
        expectedSalary: application.expectedSalary || 0,
        noticePeriod: parseNoticePeriod(application.professionalInfo?.noticePeriod),
        
        // Education
        education: [{
          degree: application.education?.highestEducation || 'Bachelor\'s Degree',
          institution: application.education?.institution || '',
          field: 'Computer Science',
          graduationYear: parseInt(application.education?.graduationYear) || 2020,
          gpa: parseFloat(application.education?.gpa) || 3.0
        }],
        
        // Skills
        skills: parseSkills(application.skills?.technicalSkills),
        
        // Certifications
        certifications: parseCertifications(application.skills?.certifications),
        
        // Languages
        languages: parseLanguages(application.skills?.languages),
        
        // Documents
        resume: application.resume || null,
        coverLetter: application.coverLetterFile || null,
        
        // Source
        source: 'direct_application',
        sourceDetails: `Applied via affiliate code: ${application.affiliateCode}`,
        
        // Status
        status: 'shortlisted',
        
        // Availability
        availability: application.availability || 'negotiable',
        
        // Notes
        notes: [{
          content: application.evaluation?.shortlistReason || 'Automatically shortlisted from application',
          createdBy: new mongoose.Types.ObjectId() // Dummy user ID
        }]
      };
      
      const candidate = new Candidate(candidateData);
      await candidate.save();
      
      // Update application with candidate reference
      application.candidate = candidate._id;
      await application.save();
      
      return candidate;
      
    } catch (error) {
      console.error('Error creating candidate from application:', error);
      throw error;
    }
  }
}

module.exports = new ApplicationEvaluationService(); 