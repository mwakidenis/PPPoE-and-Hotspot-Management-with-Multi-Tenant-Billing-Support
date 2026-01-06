import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

/**
 * GET /api/whatsapp/reminder-settings - Get current reminder settings
 */
export async function GET(request: NextRequest) {
  try {
    // Get the first (and only) settings record
    let settings = await prisma.whatsapp_reminder_settings.findFirst()
    
    // If no settings exist, create default
    if (!settings) {
      settings = await prisma.whatsapp_reminder_settings.create({
        data: {
          id: nanoid(),
          enabled: true,
          reminderDays: JSON.stringify([-7, -5, -3, 0]), // Default: H-7, H-5, H-3, H
          reminderTime: '09:00' // Default: 9 AM WIB
        }
      })
    }
    
    return NextResponse.json({
      success: true,
      settings: {
        id: settings.id,
        enabled: settings.enabled,
        reminderDays: JSON.parse(settings.reminderDays),
        reminderTime: settings.reminderTime,
        otpEnabled: settings.otpEnabled,
        otpExpiry: settings.otpExpiry,
        createdAt: settings.createdAt,
        updatedAt: settings.updatedAt
      }
    })
  } catch (error: any) {
    console.error('Get reminder settings error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

/**
 * PUT /api/whatsapp/reminder-settings - Update reminder settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { enabled, reminderDays, reminderTime, otpEnabled, otpExpiry } = body
    
    // Validation
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'enabled must be a boolean'
      }, { status: 400 })
    }
    
    if (!Array.isArray(reminderDays)) {
      return NextResponse.json({
        success: false,
        error: 'reminderDays must be an array'
      }, { status: 400 })
    }
    
    // Validate reminderDays values (must be negative or 0)
    for (const day of reminderDays) {
      if (typeof day !== 'number' || day > 0) {
        return NextResponse.json({
          success: false,
          error: 'reminderDays must contain numbers <= 0 (e.g., -7, -5, -3, 0)'
        }, { status: 400 })
      }
    }
    
    // Validate reminderTime format (HH:mm)
    if (!/^\d{2}:\d{2}$/.test(reminderTime)) {
      return NextResponse.json({
        success: false,
        error: 'reminderTime must be in HH:mm format (e.g., 09:00)'
      }, { status: 400 })
    }
    
    // Get existing settings or create new
    let settings = await prisma.whatsapp_reminder_settings.findFirst()
    
    // Prepare update data
    const updateData: any = {
      enabled,
      reminderDays: JSON.stringify(reminderDays),
      reminderTime
    }
    
    // Add OTP fields if provided
    if (typeof otpEnabled === 'boolean') {
      updateData.otpEnabled = otpEnabled
    }
    if (typeof otpExpiry === 'number' && otpExpiry > 0) {
      updateData.otpExpiry = otpExpiry
    }
    
    if (settings) {
      // Update existing
      settings = await prisma.whatsapp_reminder_settings.update({
        where: { id: settings.id },
        data: updateData
      })
    } else {
      // Create new
      settings = await prisma.whatsapp_reminder_settings.create({
        data: {
          id: nanoid(),
          ...updateData
        }
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Reminder settings updated successfully',
      settings: {
        id: settings.id,
        enabled: settings.enabled,
        reminderDays: JSON.parse(settings.reminderDays),
        reminderTime: settings.reminderTime,
        otpEnabled: settings.otpEnabled,
        otpExpiry: settings.otpExpiry,
        updatedAt: settings.updatedAt
      }
    })
  } catch (error: any) {
    console.error('Update reminder settings error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
