import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

// Haversine formula to calculate distance between two GPS coordinates
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// GET - Get all customer assignments or get nearest ODPs for a customer
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    // If customerId is provided, return nearest ODPs
    if (customerId) {
      const customer = await prisma.pppoeUser.findUnique({
        where: { id: customerId },
        select: { latitude: true, longitude: true },
      });

      if (!customer || !customer.latitude || !customer.longitude) {
        return NextResponse.json(
          { error: 'Customer not found or missing GPS coordinates' },
          { status: 404 }
        );
      }

      // Get all ODPs with their assignments
      const odps = await prisma.networkODP.findMany({
        include: {
          odc: true,
          olt: true,
          parentOdp: true,
          customers: true,
        },
      });

      // Calculate distance and sort by nearest
      const odpsWithDistance = odps
        .map((odp) => {
          const distance = calculateDistance(
            customer.latitude!,
            customer.longitude!,
            odp.latitude,
            odp.longitude
          );

          // Get available ports
          const assignedPorts = odp.customers.map((c) => c.portNumber);
          const availablePorts = Array.from(
            { length: odp.portCount },
            (_, i) => i + 1
          ).filter((port) => !assignedPorts.includes(port));

          return {
            ...odp,
            distance: parseFloat(distance.toFixed(2)),
            availablePorts,
            assignedCount: odp.customers.length,
          };
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10); // Return top 10 nearest ODPs

      return NextResponse.json(odpsWithDistance);
    }

    // Otherwise, return all customer assignments
    const assignments = await prisma.odpCustomerAssignment.findMany({
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            username: true,
            phone: true,
            address: true,
            latitude: true,
            longitude: true,
            status: true,
            profile: {
              select: {
                name: true,
              },
            },
          },
        },
        odp: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            ponPort: true,
            portCount: true,
            odc: {
              select: {
                name: true,
              },
            },
            olt: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error('Error fetching customer assignments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer assignments' },
      { status: 500 }
    );
  }
}

// POST - Create new customer assignment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, odpId, portNumber, notes } = body;

    if (!customerId || !odpId || !portNumber) {
      return NextResponse.json(
        { error: 'Customer ID, ODP ID, and port number are required' },
        { status: 400 }
      );
    }

    // Check if customer exists and has GPS coordinates
    const customer = await prisma.pppoeUser.findUnique({
      where: { id: customerId },
      select: { latitude: true, longitude: true },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Check if ODP exists
    const odp = await prisma.networkODP.findUnique({
      where: { id: odpId },
      include: { customers: true },
    });

    if (!odp) {
      return NextResponse.json({ error: 'ODP not found' }, { status: 404 });
    }

    // Check if port is available
    const portUsed = odp.customers.some((c) => c.portNumber === portNumber);
    if (portUsed) {
      return NextResponse.json(
        { error: 'Port number is already assigned' },
        { status: 400 }
      );
    }

    // Check if port number is valid
    if (portNumber < 1 || portNumber > odp.portCount) {
      return NextResponse.json(
        { error: `Port number must be between 1 and ${odp.portCount}` },
        { status: 400 }
      );
    }

    // Check if customer is already assigned
    const existingAssignment = await prisma.odpCustomerAssignment.findUnique({
      where: { customerId },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'Customer is already assigned to an ODP' },
        { status: 400 }
      );
    }

    // Calculate distance
    let distance = null;
    if (customer.latitude && customer.longitude) {
      distance = calculateDistance(
        customer.latitude,
        customer.longitude,
        odp.latitude,
        odp.longitude
      );
    }

    // Create assignment
    const assignment = await prisma.odpCustomerAssignment.create({
      data: {
        id: nanoid(),
        customerId,
        odpId,
        portNumber,
        distance,
        notes,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            username: true,
            phone: true,
            address: true,
            status: true,
          },
        },
        odp: {
          select: {
            id: true,
            name: true,
            ponPort: true,
            portCount: true,
          },
        },
      },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('Error creating customer assignment:', error);
    return NextResponse.json(
      { error: 'Failed to create customer assignment' },
      { status: 500 }
    );
  }
}

// PUT - Update customer assignment
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, odpId, portNumber, notes } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Assignment ID is required' },
        { status: 400 }
      );
    }

    // Get existing assignment
    const existingAssignment = await prisma.odpCustomerAssignment.findUnique({
      where: { id },
      include: { customer: true, odp: true },
    });

    if (!existingAssignment) {
      return NextResponse.json(
        { error: 'Assignment not found' },
        { status: 404 }
      );
    }

    // If changing ODP or port, validate
    if (odpId || portNumber) {
      const targetOdpId = odpId || existingAssignment.odpId;
      const targetPort = portNumber || existingAssignment.portNumber;

      const odp = await prisma.networkODP.findUnique({
        where: { id: targetOdpId },
        include: { customers: true },
      });

      if (!odp) {
        return NextResponse.json({ error: 'ODP not found' }, { status: 404 });
      }

      // Check if port is available (excluding current assignment)
      const portUsed = odp.customers.some(
        (c) => c.portNumber === targetPort && c.id !== id
      );
      if (portUsed) {
        return NextResponse.json(
          { error: 'Port number is already assigned' },
          { status: 400 }
        );
      }

      // Validate port number
      if (targetPort < 1 || targetPort > odp.portCount) {
        return NextResponse.json(
          { error: `Port number must be between 1 and ${odp.portCount}` },
          { status: 400 }
        );
      }
    }

    // Calculate new distance if ODP changed
    let distance = existingAssignment.distance;
    if (odpId && odpId !== existingAssignment.odpId) {
      const odp = await prisma.networkODP.findUnique({
        where: { id: odpId },
      });

      if (
        odp &&
        existingAssignment.customer.latitude &&
        existingAssignment.customer.longitude
      ) {
        distance = calculateDistance(
          existingAssignment.customer.latitude,
          existingAssignment.customer.longitude,
          odp.latitude,
          odp.longitude
        );
      }
    }

    // Update assignment
    const updatedAssignment = await prisma.odpCustomerAssignment.update({
      where: { id },
      data: {
        odpId: odpId || existingAssignment.odpId,
        portNumber: portNumber || existingAssignment.portNumber,
        distance,
        notes: notes !== undefined ? notes : existingAssignment.notes,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            username: true,
            phone: true,
            address: true,
            status: true,
          },
        },
        odp: {
          select: {
            id: true,
            name: true,
            ponPort: true,
            portCount: true,
          },
        },
      },
    });

    return NextResponse.json(updatedAssignment);
  } catch (error) {
    console.error('Error updating customer assignment:', error);
    return NextResponse.json(
      { error: 'Failed to update customer assignment' },
      { status: 500 }
    );
  }
}

// DELETE - Remove customer assignment
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Assignment ID is required' },
        { status: 400 }
      );
    }

    await prisma.odpCustomerAssignment.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Assignment deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer assignment:', error);
    return NextResponse.json(
      { error: 'Failed to delete customer assignment' },
      { status: 500 }
    );
  }
}
