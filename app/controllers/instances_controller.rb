# frozen_string_literal: true
class InstancesController < ApplicationController
  before_action :load_instance, except: %i[index new create]

  def index
    @instances = Instance.includes(%i[moderatorships moderators])
                         .all_for_user(current_or_guest_user)
    @users_all = User.not_anonymous
  end

  def show
    authorize! :read, @instance
  end

  def new
    authorize! :create, Instance

    @instance = Instance.new
  end

  def create
    authorize! :create, Instance

    @instance = Instance.new(instance_params.merge(owner_id: current_or_guest_user.id))
    if @instance.save
      redirect_to instances_url, notice: 'Instance is created successfully'
    else
      render :new
    end
  end

  def edit
    authorize! :update, @instance
  end

  def update
    authorize! :update, @instance

    if @instance.update_attributes(instance_params)
      redirect_to instances_url, notice: 'Topic has been updated successfully'
    else
      render :edit
    end
  end

  def destroy
    authorize! :destroy, @instance

    @instance.destroy
    redirect_to instances_url, notice: 'Topic has been deleted successfully'
  end

  def close
    authorize! :toggle_open_topic, @instance

    if @instance.update_attributes(closed: true)
      redirect_to request.referer, notice: 'Topic has been closed'
    else
      redirect_to request.referer, notice: 'Something went wrong, try again'
    end
  end

  def open
    authorize! :toggle_open_topic, @instance

    if @instance.update_attributes(closed: false)
      redirect_to request.referer, notice: 'Topic has been opened'
    else
      redirect_to request.referer, notice: 'Something went wrong, try again'
    end
  end

  def private
    authorize! :update, @instance

    if @instance.update_attributes(private: true)
      redirect_to request.referer, notice: 'Topic has been set as private'
    else
      redirect_to request.referer, notice: 'Something went wrong, try again'
    end
  end

  def unprivate
    authorize! :update, @instance

    if @instance.update_attributes(private: false)
      redirect_to request.referer, notice: 'Topic has been set as not private'
    else
      redirect_to request.referer, notice: 'Something went wrong, try again'
    end
  end

  def set_moderators
    authorize! :set_moderators, @instance

    users = User.where(id: params[:instance][:moderators])
    users.each do |user|
      unless user.role? Role.moderator
        user.roles << Role.moderator
        user.save!
      end
    end

    if @instance.update_attributes(moderators: User.where(id: params[:instance][:moderators]))
      redirect_to request.referer, notice: 'Moderators have been set'
    else
      redirect_to request.referer, notice: 'Something went wrong, try again'
    end
  end

  def export
    filename = @instance.title.tr(' ', '_')

    headers['Content-Type'] = 'text/plain'
    headers['Content-Disposition'] = "attachment; filename=#{filename}_export.txt"

    self.response_body = Enumerator.new do |output|
      output << "#{@instance.title}\n\n"

      @instance.rooms_sorted_by_last_message.includes(messages: :user).each do |room|
        messages = room.messages.includes(:user).order(:created_at)
        message_count = messages.size
        latest_message_date = messages.last&.created_at&.to_formatted_s(:long_ordinal)

        output << room.title
        output << " (#{message_count} #{'reply'.pluralize(message_count)}"
        output << " / last update #{latest_message_date}" if latest_message_date
        output << ")\n"

        messages.each do |message|
          message_content = message.content.delete("\r\n\\")
          output << "#{message.user.nickname_in_room(room)}: #{message_content}\n"
        end

        output << "\n"
      end
    end
  end

  private

  def instance_params
    params.require(:instance).permit(:title, :closed, :private, :moderators)
  end

  def load_instance
    @instance = Instance.find(params[:id])
  end
end
