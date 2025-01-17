const sqlModel = require("../../config/db");


exports.getAdvance = async (req, res, next) => {
    try {
      const emp_id = req.params.emp_id;
  
      if (!emp_id) {
        return res.status(400).send({ status: false, message: "Employee ID is required" });
      }
  
      // Fetch advances
      const advances = await sqlModel.select("emp_advances_detail", {}, {
        emp_id: emp_id,
        status: 'active',
      });
  
      if (advances.error) {
        return res.status(500).send({ status: false, error: advances.error });
      }

      const totalAmount = advances.reduce(
        (sum, record) => sum + parseFloat(record.advance_amount || 0), 
        0
      );
  
     
      const totalBalance = advances.reduce(
        (sum, record) => sum + parseFloat(record.remaining_balance || 0), 
        0
      );
  
      res.status(200).send({
        status: true,
        advances,
        total_balance: totalBalance.toFixed(2),
        totalAmount:totalAmount.toFixed(2)
      });
    } catch (error) {
      res.status(500).send({ status: false, error: error.message });
    }
};
  

exports.addAdvance = async (req, res, next) => {
  try {
    const id = req.params.id || "";
    const { emp_id, advance_amount } = req.body;

    if (!emp_id || !advance_amount) {
      return res.status(400).send({ status: false, message: "Employee ID and Advance Amount are required" });
    }

    const insert = { ...req.body };

    if (id) {
    
      const advanceRecord = await sqlModel.select("emp_advances_detail", ["id"], { id });

      if (advanceRecord.error || advanceRecord.length === 0) {
        return res.status(404).send({ status: false, message: "Advance not found" });
      }

      insert.updated_at = getCurrentDateTime();
      const updateResult = await sqlModel.update("emp_advances_detail", insert, { id });

      if (updateResult.error) {
        return res.status(500).send(updateResult);
      }

      return res.status(200).send({ status: true, message: "Advance updated successfully" });
    } else {
        // insert.advance_amount = advance_amount.toFixed(2); 
      insert.created_at = getCurrentDateTime();
      insert.company_id = req.user.id;
      insert.transaction_date = getCurrentDateTime();
      insert.remaining_balance = advance_amount; 
      insert.status = 'active'
      const saveResult = await sqlModel.insert("emp_advances_detail", insert);

      if (saveResult.error) {
        return res.status(500).send(saveResult);
      }

      return res.status(200).send({ status: true, message: "Advance added successfully" });
    }
  } catch (error) {
    res.status(500).send({ status: false, error: error.message });
  }
};



exports.getAdjustment = async(req, res, next) =>{
    try{

        const emp_id = req.params.emp_id;
  
        if (!emp_id) {
          return res.status(400).send({ status: false, message: "Employee ID is required" });
        }
    
        const adjustment = await sqlModel.select("advance_adjustments", {}, {
          emp_id: emp_id,
        });
    
        if (adjustment.error) {
          return res.status(500).send({ status: false, error: adjustment.error });
        }
    
        // Calculate total adjustment amount
        const totaladjustment = adjustment.reduce(
          (sum, record) => sum + parseFloat(record.adjustment_amount || 0), 
          0
        );
    
        res.status(200).send({
          status: true,
          adjustment,
          total_adjustment: totaladjustment.toFixed(2),
        });

    }catch(error){
        res.status(500).send({ status: false, error: error.message });
    }
}

exports.applyAdjustment = async (req, res, next) => {
    try {
      const { emp_id, adjustment_amount, notes } = req.body;
  
      if (!emp_id || adjustment_amount === undefined) {
        return res.status(400).send({ status: false, message: "Employee ID and Adjustment Amount are required" });
      }
  
      
   
    const  advances = await sqlModel.customQuery(`
        SELECT * 
        FROM emp_advances_detail 
        WHERE emp_id = ? 
          AND status = 'active' 
          AND CAST(remaining_balance AS DECIMAL(10, 2)) > 0
      `, [emp_id]);


 
      
      if (advances.error) {
        return res.status(500).send({ status: false, error: advances.error });
      }
  
      if (advances.length === 0) {
        return res.status(404).send({ status: false, message: "No open advances found for this employee" });
      }

      const totalRemainingBalance = advances.reduce((sum, advance) => {
        return sum + parseFloat(advance.remaining_balance || 0);
      }, 0);
  
    
      if (adjustment_amount > totalRemainingBalance) {
        return res.status(404).send({
          status: false,
          message: `Adjustment amount (${adjustment_amount}) exceeds the total remaining balance (${totalRemainingBalance.toFixed(2)}).`
        });
      }

  
      let remainingAdjustment = adjustment_amount;
      const adjustmentDate = getCurrentDateTime(); 
  
      // Apply adjustments to advances in FIFO order
      for (const advance of advances) {
        if (remainingAdjustment <= 0) break;
  
        const adjustment = Math.min(remainingAdjustment, advance.remaining_balance);
        const newBalance = advance.remaining_balance - adjustment;
  
       
        const updateResult = await sqlModel.update(
          "emp_advances_detail",
          { remaining_balance: newBalance },
          { id: advance.id }
        );
  
        if (updateResult.error) {
          return res.status(500).send(updateResult);
        }
  
      
        const adjustmentData = {
            emp_id :emp_id,
            company_id :req.user.id,
          advance_id: advance.id,
          adjustment_amount: adjustment.toFixed(2),
          adjustment_date: adjustmentDate,
          notes: notes || '',
          created_at: adjustmentDate,
          updated_at: adjustmentDate,
        };
  
        const insertAdjustmentResult = await sqlModel.insert("advance_adjustments", adjustmentData);
  
        if (insertAdjustmentResult.error) {
          return res.status(500).send(insertAdjustmentResult);
        }
  
        remainingAdjustment -= adjustment;
      }
  
     
      const unallocatedAdjustment = remainingAdjustment > 0 ? remainingAdjustment : 0;
  
      return res.status(200).send({
        status: true,
        message: "Adjustment applied successfully",
        unallocated_amount: unallocatedAdjustment,
      });
    } catch (error) {
      res.status(500).send({ status: false, error: error.message });
    }
};


exports.editAdjustment = async (req, res, next) => {
    try {
        const adjustment_id = req.params.id;
      const {  adjustment_amount, notes } = req.body;
  
      if (!adjustment_id || adjustment_amount === undefined) {
        return res.status(400).send({
          status: false,
          message: "Adjustment ID and new adjustment amount are required",
        });
      }
  
    
      const adjustmentRecord = await sqlModel.select("advance_adjustments", "*", { id: adjustment_id });
      if (!adjustmentRecord || adjustmentRecord.length === 0) {
        return res.status(404).send({ status: false, message: "Adjustment not found" });
      }
  
      const adjustment = adjustmentRecord[0];
 
      const advanceRecord = await sqlModel.select("emp_advances_detail", "*", { id: adjustment.advance_id });
      if (!advanceRecord || advanceRecord.length === 0) {
        return res.status(404).send({ status: false, message: "Advance not found" });
      }
  
      const advance = advanceRecord[0];
  
    
      const oldAdjustmentAmount = parseFloat(adjustment.adjustment_amount);
      const newAdjustmentAmount = parseFloat(adjustment_amount);
  
      if (isNaN(newAdjustmentAmount) || newAdjustmentAmount <= 0) {
        return res.status(400).send({ status: false, message: "Invalid adjustment amount" });
      }
  

      const adjustmentDifference = newAdjustmentAmount - oldAdjustmentAmount;
      const newRemainingBalance = parseFloat(advance.remaining_balance) - adjustmentDifference;
  
      if (newRemainingBalance < 0) {
        return res.status(400).send({
          status: false,
          message: `New adjustment amount exceeds available balance. Remaining balance: ${advance.remaining_balance}`,
        });
      }
  

      const updateAdvanceResult = await sqlModel.update(
        "emp_advances_detail",
        { remaining_balance: newRemainingBalance.toFixed(2) },
        { id: advance.id }
      );
      if (updateAdvanceResult.error) {
        return res.status(500).send({ status: false, error: updateAdvanceResult.error });
      }
  
     
      const updatedAdjustment = {
        adjustment_amount: newAdjustmentAmount.toFixed(2),
        notes: notes || adjustment.notes,
        updated_at: getCurrentDateTime(),
      };
  
      const updateAdjustmentResult = await sqlModel.update("advance_adjustments", updatedAdjustment, { id: adjustment_id });
      if (updateAdjustmentResult.error) {
        return res.status(500).send({ status: false, error: updateAdjustmentResult.error });
      }
  
      return res.status(200).send({
        status: true,
        message: "Adjustment updated successfully",
      });
    } catch (error) {
      res.status(500).send({ status: false, error: error.message });
    }
};
  
  
exports.getOpenAdvances = async (req, res, next) => {
    try {
      const { emp_id } = req.params;
  
      if (!emp_id) {
        return res.status(400).send({ status: false, message: "Employee ID is required" });
      }


      const  advances = await sqlModel.customQuery(`
        SELECT * 
        FROM emp_advances_detail 
        WHERE emp_id = ? 
          AND status = 'active' 
          AND CAST(remaining_balance AS DECIMAL(10, 2)) > 0
      `, [emp_id]);
  
      if (advances.error) {
        return res.status(500).send({ status: false, error: advances.error });
      }
  
    //   if (advances.length === 0) {
    //     return res.status(404).send({ status: false  });
    //     // message: "No open advances found"
    //   }

      const totalBalance = advances.reduce(
        (sum, record) => sum + parseFloat(record.remaining_balance || 0), 
        0
      );
  
      return res.status(200).send({
        status: true,
        open_advances: advances,
        totalBalance
      });
    } catch (error) {
      res.status(500).send({ status: false, error: error.message });
    }
};
  

exports.updateAdvance = async (req, res, next) => {
    try {
      const { id } = req.params;
      const updates = { ...req.body };
  
      if (!id) {
        return res.status(400).send({ status: false, message: "Advance ID is required" });
      }
  
     
      const advance = await sqlModel.select("emp_advances_detail", "*", { id });
      if (!advance || advance.error || advance.length === 0) {
        return res.status(404).send({ status: false, message: "Advance not found" });
      }
  
      const currentAdvance = advance[0];
  
      const adjustments = await sqlModel.select("advance_adjustments", "*", { advance_id: id });
      const totalAdjustedAmount = adjustments.reduce(
        (sum, record) => sum + parseFloat(record.adjustment_amount || 0),
        0
      );
  
    
      if (totalAdjustedAmount > 0 && updates.advance_amount !== undefined) {
        const newAdvanceAmount = parseFloat(updates.advance_amount);
        if (isNaN(newAdvanceAmount)) {
          return res.status(400).send({ 
            status: false, 
            message: "Advance amount must be a valid number." 
          });
        }
  
        if (newAdvanceAmount < totalAdjustedAmount) {
          return res.status(400).send({
            status: false,
            message: "New advance amount cannot be less than the total adjusted amount."
          });
        }
      }
  
      // Update remaining_balance if advance_amount is updated and no adjustments have been made
      if (updates.advance_amount !== undefined) {
        const newAdvanceAmount = parseFloat(updates.advance_amount);
        if (isNaN(newAdvanceAmount)) {
          return res.status(400).send({ 
            status: false, 
            message: "Advance amount must be a valid number." 
          });
        }
  
        // Synchronize remaining_balance with advance_amount
        if (totalAdjustedAmount === 0) {
          updates.remaining_balance = newAdvanceAmount.toFixed(2)
        }
      }
  
      // Validate advance_date if provided
      if (updates.transaction_date && new Date(updates.transaction_date) > getCurrentDateTime()) {
        return res.status(400).send({ 
          status: false, 
          message: "Transaction date cannot be in the future." 
        });
      }
  

      const logData = {
        advance_id: id,
        action: "update",
        old_data: JSON.stringify(currentAdvance),
        new_data: JSON.stringify(updates),
        changed_by: req.user.id,
        changed_at: getCurrentDateTime(),
      };
      await sqlModel.insert("advance_logs", logData);
  

      updates.updated_at = getCurrentDateTime();
      const result = await sqlModel.update("emp_advances_detail", updates, { id });
  
      if (result.error) {
        return res.status(500).send(result);
      }
  
      return res.status(200).send({ status: true, message: "Advance updated successfully" });
    } catch (error) {
      res.status(500).send({ status: false, error: error.message });
    }
};
  

exports.deleteAdvance = async (req, res, next) => {
    try {
      const { id } = req.params;
  
      if (!id) {
        return res.status(400).send({ status: false, message: "Advance ID is required" });
      }
  
    
      const advance = await sqlModel.select("emp_advances_detail", "*", { id });
      if (!advance || advance.error || advance.length === 0) {
        return res.status(404).send({ status: false, message: "Advance not found" });
      }
  
      const currentAdvance = advance[0];
  
    
      if (currentAdvance.adjusted_amount > 0) {
        return res.status(400).send({ 
          status: false, 
          message: "Cannot delete advance as adjustments have already been made." 
        });
      }
  
     
      if (currentAdvance.remaining_balance <= 0) {
        return res.status(400).send({ 
          status: false, 
          message: "Cannot delete a fully settled advance." 
        });
      }
  
      
      const logData = {
        advance_id: id,
        action: "delete",
        old_data: JSON.stringify(currentAdvance),
        changed_by: req.user.id, 
        changed_at: getCurrentDateTime(),
      };
      await sqlModel.insert("advance_logs", logData);
  
     
      const result = await sqlModel.update("emp_advances_detail", { 
        status: "deleted", 
        updated_at: getCurrentDateTime() 
      }, { id });
  
      if (result.error) {
        return res.status(500).send(result);
      }
  
      return res.status(200).send({ status: true, message: "Advance deleted successfully" });
    } catch (error) {
      res.status(500).send({ status: false, error: error.message });
    }
};
  
  
  