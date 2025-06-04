// src/utils/role-hierarchy.js
const { Role } = require('../models');
const logger = require('../utils/logger');

/**
 * Utility for managing role hierarchy relationships
 */
const RoleHierarchy = {
  /**
   * Build a full role hierarchy tree
   * @returns {Promise<Object>} - Hierarchy tree
   */
  buildHierarchyTree: async () => {
    try {
      // Get all roles with parent information
      const roles = await Role.find().populate('parents');
      const roleMap = {};
      
      // Create initial map of roles
      roles.forEach(role => {
        roleMap[role._id.toString()] = {
          _id: role._id,
          name: role.name,
          level: role.level,
          description: role.description,
          parents: role.parents.map(p => p._id.toString()),
          children: []
        };
      });
      
      // Add children relationships
      roles.forEach(role => {
        if (role.parents && role.parents.length > 0) {
          role.parents.forEach(parent => {
            const parentId = parent._id.toString();
            if (roleMap[parentId] && !roleMap[parentId].children.includes(role._id.toString())) {
              roleMap[parentId].children.push(role._id.toString());
            }
          });
        }
      });
      
      return roleMap;
    } catch (error) {
      logger.error('Error building role hierarchy', { error: error.message });
      throw error;
    }
  },
  
  /**
   * Get all ancestor roles for a given role
   * @param {string} roleId - Role ID
   * @returns {Promise<Array>} - Array of ancestor role IDs
   */
  getAncestors: async (roleId) => {
    try {
      const role = await Role.findById(roleId).populate('parents');
      if (!role) {
        return [];
      }
      
      const ancestors = [];
      const parentIds = role.parents.map(p => p._id.toString());
      
      ancestors.push(...parentIds);
      
      // Recursively get ancestors of parents
      for (const parentId of parentIds) {
        const parentAncestors = await RoleHierarchy.getAncestors(parentId);
        ancestors.push(...parentAncestors);
      }
      
      // Remove duplicates
      return [...new Set(ancestors)];
    } catch (error) {
      logger.error('Error getting role ancestors', {
        error: error.message,
        roleId
      });
      throw error;
    }
  },
  
  /**
   * Get all descendant roles for a given role
   * @param {string} roleId - Role ID
   * @returns {Promise<Array>} - Array of descendant role IDs
   */
  getDescendants: async (roleId) => {
    try {
      const hierarchyTree = await RoleHierarchy.buildHierarchyTree();
      const roleNode = hierarchyTree[roleId];
      
      if (!roleNode) {
        return [];
      }
      
      const descendants = [];
      const children = roleNode.children;
      
      descendants.push(...children);
      
      // Recursively get descendants
      for (const childId of children) {
        const childDescendants = await RoleHierarchy.getDescendants(childId);
        descendants.push(...childDescendants);
      }
      
      // Remove duplicates
      return [...new Set(descendants)];
    } catch (error) {
      logger.error('Error getting role descendants', {
        error: error.message,
        roleId
      });
      throw error;
    }
  },
  
  /**
   * Check if one role is a descendant of another
   * @param {string} roleId - Child role ID to check
   * @param {string} ancestorId - Potential ancestor role ID
   * @returns {Promise<boolean>} - True if ancestorId is an ancestor of roleId
   */
  isDescendantOf: async (roleId, ancestorId) => {
    try {
      const ancestors = await RoleHierarchy.getAncestors(roleId);
      return ancestors.includes(ancestorId);
    } catch (error) {
      logger.error('Error checking role descendant relationship', {
        error: error.message,
        roleId,
        ancestorId
      });
      return false;
    }
  },
  
  /**
   * Find the common ancestor of multiple roles (lowest common ancestor)
   * @param {Array<string>} roleIds - Array of role IDs
   * @returns {Promise<string|null>} - Common ancestor role ID or null
   */
  findCommonAncestor: async (roleIds) => {
    try {
      if (!roleIds || roleIds.length === 0) {
        return null;
      }
      
      if (roleIds.length === 1) {
        return roleIds[0];
      }
      
      // Get ancestors for each role
      const ancestorSets = await Promise.all(
        roleIds.map(async (id) => {
          const ancestors = await RoleHierarchy.getAncestors(id);
          // Include the role itself in its ancestors
          ancestors.push(id);
          return new Set(ancestors);
        })
      );
      
      // Find common ancestors
      const firstSet = ancestorSets[0];
      const commonAncestors = [...firstSet].filter(ancestor => 
        ancestorSets.every(set => set.has(ancestor))
      );
      
      if (commonAncestors.length === 0) {
        return null;
      }
      
      // Find the lowest level common ancestor (most specific)
      const roles = await Role.find({
        _id: { $in: commonAncestors }
      });
      
      // Sort by level descending (higher level = more specific)
      roles.sort((a, b) => b.level - a.level);
      
      return roles[0]._id.toString();
    } catch (error) {
      logger.error('Error finding common ancestor', {
        error: error.message,
        roleIds
      });
      return null;
    }
  }
};

module.exports = RoleHierarchy;